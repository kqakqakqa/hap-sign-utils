import fs from "fs";
import path from "path";

const MAGIC_BYTE = 0xBE;
const SIGN_HEAD_PREFIX = Buffer.from("hw signed app   1000", "utf-8");
const SIGN_HEAD_SUFFIX = Buffer.from([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00]);

function extractHapPackages(buffer, outputDir) {
  let offset = 0;
  const totalLength = buffer.length;
  let count = 0;

  while (offset < totalLength) {
    if (buffer[offset] !== MAGIC_BYTE) {
      offset++;
      continue;
    }

    // console.debug(`read MAGIC BYTE at ${offset}`);

    if (offset + 5 > totalLength) {
      offset++;
      continue;
    }
    const nameLen = buffer.readUInt32BE(offset + 1);
    if (nameLen === 0 || nameLen > 256 || offset + 5 + nameLen > totalLength) {
      offset++;
      continue;
    }

    const bundleName = buffer.slice(offset + 5, offset + 5 + nameLen).toString("utf-8");
    if (!/^[\x20-\x7E\u4E00-\u9FFF]+$/.test(bundleName) || bundleName.length < 3) {
      offset++;
      continue;
    }

    console.info(`识别到 ${bundleName}`);

    let signOffset = offset + 5 + nameLen;
    let found = false;

    while (signOffset + 32 <= totalLength) {
      if (
        buffer.slice(signOffset, signOffset + SIGN_HEAD_PREFIX.length).equals(SIGN_HEAD_PREFIX) &&
        buffer.slice(signOffset + SIGN_HEAD_PREFIX.length + 4, signOffset + 32).equals(SIGN_HEAD_SUFFIX)
      ) {
        found = true;
        break;
      }
      signOffset++;
    }

    if (!found) {
      console.warn(`未找到 signHead，跳过: ${bundleName}`);
      offset += 1;
      continue;
    }

    const hapBuffer = buffer.slice(offset, signOffset + 32);
    const filePath = path.join(outputDir, `${bundleName}.bin`);
    fs.writeFileSync(filePath, hapBuffer);
    console.log(`提取了 ${bundleName}, 大小 ${hapBuffer.length} 字节`);
    count++;

    offset = signOffset + 32;
  }

  console.log(`共提取 ${count} 个应用包`);
}

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    return console.error("usage: node extract-bin-from-firmware.js <firmware.bin>");
  }
  const outputDir = path.dirname(inputFile);
  fs.mkdirSync(outputDir, { recursive: true });

  const buf = fs.readFileSync(inputFile);
  extractHapPackages(buf, outputDir);
}

main().catch(e => console.error(e));