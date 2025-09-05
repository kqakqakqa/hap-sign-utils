marker = b"hw signed app   1000"

in_file = input("bin: ").strip()
out_file = input("p7b: ").strip()

with open(in_file, "rb") as f:
    data = f.read()

with open(out_file, "rb") as f:
    p7b = f.read()

# 找 p7b 在大文件中的位置
pos_p7b = data.find(p7b)
if pos_p7b == -1:
    raise ValueError("找不到 p7b 数据")

# 找 marker
pos_marker = data.find(marker, pos_p7b + len(p7b))
if pos_marker == -1:
    raise ValueError("找不到结尾标记")

# 目标数据范围
start = pos_p7b + len(p7b)
end = pos_marker
target = data[start:end]

with open("extracted.p7b", "wb") as f:
    f.write(target)

print(f"已提取 {len(target)} 字节 -> extracted.p7b")
