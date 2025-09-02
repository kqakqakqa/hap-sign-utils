@echo off
setlocal enabledelayedexpansion

echo 输入程序包路径（app/裸hap/bin）:
if "%~1"=="" (
  set /p inputFile=
) else (
  echo %~1
  set "inputFile=%~1"
)

:: 获取扩展名
for %%f in ("%inputFile%") do (
  set "fileExt=%%~xf"
)
set "fileExt=!fileExt:~1!"
set "fileExt=!fileExt:.=!"

:: 生成唯一临时目录
set "uuid=%RANDOM%_%TIME%"
set "uuid=!uuid::=_!"
set "tmpDir=%TEMP%\hap-sign-!uuid!"
mkdir "!tmpDir!"

:: 证书目录
set certFolder="%~dp0cer"

:: 判断文件类型，跳转到对应标签处理
if /i "!fileExt!"=="hap" goto handle_hap
if /i "!fileExt!"=="app" goto handle_app
if /i "!fileExt!"=="bin" goto handle_bin
echo 不支持文件类型 .!fileExt! ，终止。
goto end



:handle_hap
:: 复制到临时目录
copy "%inputFile%" "!tmpDir!\">nul
for %%f in ("!tmpDir!\*.hap") do set "unsignedHap=%%f"
if not defined unsignedHap (
  echo 未能复制 裸hap 文件，终止。
  goto end
)
goto convert_bin



:handle_app
echo 正在解压 app 文件...
bz.exe x -o:"!tmpDir!" "%inputFile%"

for %%f in ("!tmpDir!\*.hap") do set "unsignedHap=%%f"
if not defined unsignedHap (
  echo 未找到解压得到的 裸hap 文件，终止。
  goto end
)
goto convert_bin



:handle_bin
:: 复制到临时目录
copy "%inputFile%" "!tmpDir!\">nul
for %%f in ("!tmpDir!\*.bin") do set "unsignedBin=%%f"
if not defined unsignedBin (
  echo 未能复制 bin 文件，终止。
  goto end
)
pause
goto get_package_name



:convert_bin
echo 正在转换 裸hap 文件为 bin 文件...
python "%~dp0res\hap-to-bin.py" "!unsignedHap!" "!tmpDir!\hap2bin.bin"

for %%f in ("!tmpDir!\*.bin") do set "unsignedBin=%%f"
if not defined unsignedBin (
  echo 未找到转换的 bin 文件，终止。
  goto end
)
goto get_package_name



:get_package_name
echo 正在从 bin 文件读取包名...
for /f "delims=" %%i in ('python "%~dp0res\read-bin-package-name.py" "!unsignedBin!"') do (
  set "packageName=%%i"
)
if not defined packageName (
  echo 未能从 bin 文件中解析包名，终止。
  goto end
)
echo 包名为：!packageName!
goto sign_and_package



:sign_and_package
for %%f in ("%certFolder%\*.cer") do set "cerName=%%~nf"
for %%f in ("%certFolder%\*.p12") do set "p12Name=%%~nf"

if not defined cerName (
  echo 未在证书目录中找到 .cer 文件，终止。
  goto end
)

if not defined p12Name (
  echo 未在证书目录中找到 .p12 文件，终止。
  goto end
)

set "appCertFile=%certFolder%\!cerName!.cer"
set "keystoreFile=%certFolder%\!p12Name!.p12"
set "keyAlias=!p12Name!"
set "keyPwd=!p12Name!"
set "keystorePwd=!p12Name!"

set "profileFile=%certFolder%\!packageName!Debug.p7b"

if not exist "!profileFile!" (
  echo 未在证书目录中找到 !profileFile! ，终止。
  goto end
)

for /f %%i in ('powershell -nologo -command "Get-Date -Format yyyyMMdd_HHmmss"') do set "timestamp=%%i"
for %%f in ("%inputFile%") do set "hapFolder=%%~dpf"
for %%f in ("%inputFile%") do set "signedHapFile=!hapFolder!!packageName!-signed-!timestamp!.hap"
set "signedBinFile=!tmpDir!\!packageName!.bin"

echo 正在签名 bin 文件...
java -jar "%~dp0res\hap-sign-tool.jar" sign-app ^
-mode localSign ^
-keyAlias !keyAlias! ^
-keyPwd !keyPwd! ^
-appCertFile "!appCertFile!" ^
-profileFile "!profileFile!" ^
-inFile "!unsignedBin!" ^
-inForm bin ^
-signAlg SHA256withECDSA ^
-keystoreFile "!keystoreFile!" ^
-keystorePwd !keystorePwd! ^
-outFile "!signedBinFile!" ^
-signCode 0

if not exist "!signedBinFile!" (
  echo 签名失败，未生成 bin 文件。
  goto end
)

echo 正在生成最终 hap 包...
bz.exe c -fmt:zip -l:0 -zopfli "!signedHapFile!" "!signedBinFile!"

echo 打包完成：!signedHapFile!



:end
pause
rd /s /q "!tmpDir!"
cls
"%~f0"