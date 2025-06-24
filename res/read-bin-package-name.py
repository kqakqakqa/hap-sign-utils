import sys
import struct

def main():
    if len(sys.argv) < 2:
        print("Usage: python read-bin-package-name.py <binary_file>", file=sys.stderr)
        sys.exit(1)

    bin_path = sys.argv[1]
    with open(bin_path, "rb") as f:
        # 读1字节魔数
        magic_byte = f.read(1)
        if not magic_byte:
            print("Error: file too short", file=sys.stderr)
            sys.exit(1)

        magic = magic_byte[0]
        if magic != 190:
            print(f"Error: magic byte mismatch, got {magic}, expected 190", file=sys.stderr)
            sys.exit(1)

        # 读4字节包名长度（int32，小端序）
        length_bytes = f.read(4)
        if len(length_bytes) < 4:
            print("Error: file too short for length", file=sys.stderr)
            sys.exit(1)

        (name_len,) = struct.unpack(">I", length_bytes)

        # 读包名字符串
        name_bytes = f.read(name_len)
        if len(name_bytes) < name_len:
            print("Error: file too short for name string", file=sys.stderr)
            sys.exit(1)

        package_name = name_bytes.decode("utf-8")

        # 输出包名（标准输出）
        print(package_name)

if __name__ == "__main__":
    main()