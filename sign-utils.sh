#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="${SCRIPT_DIR}/cer" # 证书目录
RES_DIR="${SCRIPT_DIR}/res"
# https://github.com/openharmony/developtools_hapsigner/blob/master/dist/hap-sign-tool.jar
HAP_SIGN_TOOL="${SCRIPT_DIR}/../res/hap-sign-tool.jar" # 签名工具

command -v python3 >/dev/null 2>&1 || { echo "需要 python3，请安装"; exit 1; }
command -v java >/dev/null 2>&1 || { echo "需要 java，请安装"; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo "需要 unzip，请安装"; exit 1; }
command -v zip >/dev/null 2>&1 || { echo "需要 zip，请安装"; exit 1; }

echo "输入程序包路径（app/裸hap/bin）:"
if [ -z "$1" ]; then
    read -r inputFile
else
    echo "$1"
    inputFile="$1"
fi

if [ ! -f "$inputFile" ]; then
    echo "文件不存在: $inputFile"
    exit 1
fi

filename=$(basename -- "$inputFile")
extension="${filename##*.}"
extension=$(echo "$extension" | tr '[:upper:]' '[:lower:]')

uuid=$(date +%s%N | sha256sum | base64 | head -c 8)  # 简单随机串
tmpDir="/tmp/hap-sign-${uuid}_$$"
mkdir -p "$tmpDir"

trap 'rm -rf "$tmpDir"' EXIT

handle_hap() {
    cp "$inputFile" "$tmpDir/" || { echo "复制 hap 失败"; exit 1; }
    unsignedHap=$(find "$tmpDir" -name "*.hap" -print -quit)
    if [ -z "$unsignedHap" ]; then
        echo "未能找到 hap 文件"
        exit 1
    fi
    convert_bin
}

handle_app() {
    echo "正在解压 app 文件..."
    unzip -q "$inputFile" -d "$tmpDir" || { echo "解压失败"; exit 1; }
    unsignedHap=$(find "$tmpDir" -name "*.hap" -print -quit)
    if [ -z "$unsignedHap" ]; then
        echo "未找到解压得到的 hap 文件"
        exit 1
    fi
    convert_bin
}

handle_bin() {
    cp "$inputFile" "$tmpDir/" || { echo "复制 bin 失败"; exit 1; }
    unsignedBin=$(find "$tmpDir" -name "*.bin" -print -quit)
    if [ -z "$unsignedBin" ]; then
        echo "未能找到 bin 文件"
        exit 1
    fi
    echo "按任意键继续..."
    read -n 1 -s -r
    get_package_name
}

convert_bin() {
    echo "正在转换 hap 文件为 bin 文件..."
    python3 "${RES_DIR}/hap-to-bin.py" "$unsignedHap" "${tmpDir}/hap2bin.bin"
    unsignedBin=$(find "$tmpDir" -name "*.bin" -print -quit)
    if [ -z "$unsignedBin" ]; then
        echo "未找到转换的 bin 文件"
        exit 1
    fi
    get_package_name
}

get_package_name() {
    echo "正在从 bin 文件读取包名..."
    packageName=$(python3 "${RES_DIR}/read-bin-package-name.py" "$unsignedBin")
    if [ -z "$packageName" ]; then
        echo "未能从 bin 文件中解析包名"
        exit 1
    fi
    echo "包名为：$packageName"
    sign_and_package
}

sign_and_package() {
    # 查找证书文件
    cerFile=$(find "$CERT_DIR" -name "*.cer" -print -quit)
    p12File=$(find "$CERT_DIR" -name "*.p12" -print -quit)
    if [ -z "$cerFile" ] || [ -z "$p12File" ]; then
        echo "证书目录中缺少 .cer 或 .p12 文件"
        exit 1
    fi

    cerName=$(basename "$cerFile" .cer)
    p12Name=$(basename "$p12File" .p12)

    appCertFile="$cerFile"
    keystoreFile="$p12File"
    keyAlias="$p12Name"
    keyPwd="$p12Name"
    keystorePwd="$p12Name"

    profileFile="${CERT_DIR}/${packageName}Debug.p7b"
    if [ ! -f "$profileFile" ]; then
        echo "未找到 profile 文件: $profileFile"
        exit 1
    fi

    timestamp=$(date +%Y%m%d_%H%M%S)
    inputDir=$(dirname "$inputFile")
    signedHapFile="${inputDir}/${packageName}-signed-${timestamp}.hap"
    signedBinFile="${tmpDir}/${packageName}.bin"

    echo "正在签名 bin 文件..."
    java -jar "$HAP_SIGN_TOOL" sign-app \
        -mode localSign \
        -keyAlias "$keyAlias" \
        -keyPwd "$keyPwd" \
        -appCertFile "$appCertFile" \
        -profileFile "$profileFile" \
        -inFile "$unsignedBin" \
        -inForm bin \
        -signAlg SHA256withECDSA \
        -keystoreFile "$keystoreFile" \
        -keystorePwd "$keystorePwd" \
        -outFile "$signedBinFile" \
        -signCode 0

    if [ ! -f "$signedBinFile" ]; then
        echo "签名失败，未生成 bin 文件"
        exit 1
    fi

    echo "正在生成最终 hap 包..."
    # 使用 zip 命令创建 hap 包（实质是 zip 格式）
    zip -j -0 "$signedHapFile" "$signedBinFile" >/dev/null

    echo "打包完成：$signedHapFile"
}

case "$extension" in
    hap)
        handle_hap
        ;;
    app)
        handle_app
        ;;
    bin)
        handle_bin
        ;;
    *)
        echo "不支持文件类型 .$extension，终止。"
        exit 1
        ;;
esac

echo "按任意键继续..."
read -n 1 -s -r
clear
exec "$0"