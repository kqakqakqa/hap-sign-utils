import os
import struct

MAGIC_BYTE = 190

def read_exact(f, size):
    """确保读取指定字节数"""
    data = f.read(size)
    if len(data) != size:
        raise IOError("Unexpected end of file")
    return data

def bin_to_dir(bin_path, output_dir):
    with open(bin_path, "rb") as f:
        # 检查魔法字节
        magic = read_exact(f, 1)[0]
        if magic != MAGIC_BYTE:
            print("Invalid magic byte. Not a valid .bin file.")
            return False

        # 读取包名
        name_len = struct.unpack(">i", read_exact(f, 4))[0]
        bundle_name = read_exact(f, name_len).decode("utf-8")
        print(f"Bundle name: {bundle_name}")

        file_index = 0
        while True:
            try:
                # 文件名
                name_len_bytes = f.read(4)
                if not name_len_bytes:
                    break  # 读取完毕
                name_len = struct.unpack(">i", name_len_bytes)[0]
                file_name = read_exact(f, name_len).decode("utf-8")

                # 相对路径
                path_len = struct.unpack(">i", read_exact(f, 4))[0]
                rel_path = read_exact(f, path_len).decode("utf-8")
                if rel_path.startswith("/"):
                    rel_path = rel_path[1:]  # 移除开头的 "/"

                # 内容
                content_len = struct.unpack(">q", read_exact(f, 8))[0]
                content = read_exact(f, content_len)

                # 写入文件
                out_dir = os.path.join(output_dir, rel_path)
                os.makedirs(out_dir, exist_ok=True)
                out_path = os.path.join(out_dir, file_name)

                with open(out_path, "wb") as out_file:
                    out_file.write(content)

                file_index += 1
            except Exception as e:
                print(f"Error reading file #{file_index}: {e}")
                break

        print(f"{file_index} files extracted to {output_dir}")
        return True


# 使用示例
if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("Usage: python bin_to_dir.py input.bin output_dir")
    else:
        bin_to_dir(sys.argv[1], sys.argv[2])
