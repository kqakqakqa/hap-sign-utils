import fs from "fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node read-res-index.js <resources.index>");
  process.exit(1);
}

const buf = fs.readFileSync(file);
// u32  recordSize // 不含自身 4 字节
// u32  resType
// u32  id
// u16  valueSize
// u8[] value      // len = valueSize
// u16  nameSize
// u8[] name       // len = nameSize

const len = buf.length;
const result = [];

for (let off = 0; off + 16 < len; off++) {
  const recordSize = buf.readUInt32LE(off);
  const off_end = off + 4 + recordSize;
  if (recordSize < 12 || off_end > len) continue;

  const off_resType = off + 4;
  const resType = buf.readUInt32LE(off_resType);

  const off_id = off + 8;
  const id = buf.readUInt32LE(off_id);

  const off_valueSize = off + 12;
  const off_value = off + 14;

  const valueSize = buf.readUInt16LE(off_valueSize);
  // if (valueSize === 0) continue;

  const off_nameSize = off + valueSize + 14;
  const off_name = off + valueSize + 16;

  if (off_name > off_end) continue;

  const nameSize = buf.readUInt16LE(off_nameSize);
  // if (nameSize === 0) continue;

  if (off_name + nameSize !== off_end) continue;

  const value = buf.slice(off_value, off_value + valueSize).toString("utf8").replace(/\0/g, "");
  const name = buf.slice(off_name, off_name + nameSize).toString("utf8").replace(/\0/g, "");

  if (!name) continue;

  result.push({
    resType: resType,
    id: id,
    name: name,
    value: value,
  });
}

console.log(result);