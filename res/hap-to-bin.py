import os
import zipfile
import json
import struct

MAGIC_BYTE = 190


def unzip_hap(hap_path, extract_to):
    with zipfile.ZipFile(hap_path, "r") as zip_ref:
        zip_ref.extractall(extract_to)


def get_bundle_name(config_json_path):
    with open(config_json_path, "r", encoding="utf-8") as f:
        config = json.load(f)
        return config.get("app", {}).get("bundleName", "")


def write_file_info(base_dir, bin_file):
    file_count = 0
    for root, _, files in os.walk(base_dir):
        for file_name in files:
            abs_path = os.path.join(root, file_name)
            rel_path = os.path.relpath(root, base_dir).replace("\\", "/")
            if not rel_path.startswith("/"): rel_path = "/" + rel_path
            if rel_path == "/.":
                rel_path = ""  # 或 base_dir，或你自定义的标识
            with open(abs_path, "rb") as f:
                content = f.read()

            # 文件名
            bin_file.write(struct.pack(">i", len(file_name)))
            bin_file.write(file_name.encode("utf-8"))

            # 相对路径
            bin_file.write(struct.pack(">i", len(rel_path)))
            bin_file.write(rel_path.encode("utf-8"))

            # 内容长度 + 内容
            bin_file.write(struct.pack(">q", len(content)))  # long: 8 bytes
            bin_file.write(content)
            file_count += 1
    return file_count


def hap_to_bin(hap_path, bin_path):
    import tempfile
    import shutil

    temp_dir = tempfile.mkdtemp()

    try:
        unzip_hap(hap_path, temp_dir)
        config_path = os.path.join(temp_dir, "config.json")
        if not os.path.exists(config_path):
            print("config.json not found.")
            return False

        bundle_name = get_bundle_name(config_path)
        if not bundle_name:
            print("bundleName not found.")
            return False

        with open(bin_path, "wb") as bin_file:
            # 写入魔法字节和包名
            bin_file.write(bytes([MAGIC_BYTE]))
            bin_file.write(struct.pack(">i", len(bundle_name)))
            bin_file.write(bundle_name.encode("utf-8"))

            # 写入文件内容
            file_count = write_file_info(temp_dir, bin_file)
            print(f"{file_count} files written to bin.")

        return True

    finally:
        shutil.rmtree(temp_dir)


# 使用示例
if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("Usage: python hap_to_bin.py input.hap output.bin")
    else:
        hap_to_bin(sys.argv[1], sys.argv[2])
