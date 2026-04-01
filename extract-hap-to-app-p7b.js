import fs from "fs";
import path from "path";
import JSZip from "jszip";

main().catch(e => console.error(e));

async function main() {

  const inPath = process.argv[2];
  if (!inPath) {
    return console.error("usage: node signed-hap-to-app-p7b.js <signed.hap>");
  }

  // read zip, find signed.bin
  const inBuf = fs.readFileSync(inPath);
  const inZip = await JSZip.loadAsync(inBuf).catch(() => null);
  let signedBinBuf;
  if (inZip) {
    const files = Object.values(inZip.files);
    const signedFile = files.find(f => !f.dir && f.name.toLowerCase().endsWith(".bin"));
    if (signedFile) {
      console.log("读取到 " + signedFile.name);
      signedBinBuf = Buffer.from(await signedFile.async("arraybuffer"));
    }
  }

  if (!signedBinBuf) return console.error("没有识别到 .bin 文件");

  // find signHead
  if (signedBinBuf.length < 32) return console.error(".bin 文件太小");

  const signHead = Buffer.from(signedBinBuf.subarray(signedBinBuf.length - 32));

  const signHeadStr = signHead.toString("ascii", 0, 20);
  if (signHeadStr !== "hw signed app   1000") return console.error("signHead 格式不正确: ", signHeadStr);

  // drop signHead
  const binBuf = Buffer.from(signedBinBuf.subarray(0, signedBinBuf.length - 32));

  // find proBlock
  let proBlockPos = -1;
  for (let i = 1; i + 8 < binBuf.length; i++) {
    if ((binBuf[i] === 0x02) || (binBuf[i] === 0x01) && binBuf[i + 1] === 0x00) {
      const offsetVal = readUInt32BE(Buffer.from([binBuf[i + 4], binBuf[i + 5], binBuf[i + 6], binBuf[i + 7]]));
      if (offsetVal - i === 16) {
        console.log(i, offsetVal)
        proBlockPos = i;
        break;
      }
    }
  }
  if (proBlockPos === -1) {
    return console.error("没有找到 proBlock");
  }

  const p7bLen = readUInt16BE(binBuf, proBlockPos + 2);
  const p7bStart = proBlockPos + 8 + 8;
  const p7bEnd = p7bStart + p7bLen;
  if (p7bEnd > binBuf.length) {
    return console.error("p7b 长度超出边界");
  }
  const p7bBuf = Buffer.from(binBuf.subarray(p7bStart, p7bEnd));
  const unsignedBin = Buffer.from(binBuf.subarray(0, proBlockPos));

  // 解析 unsignedBin -> 还原 hap 文件结构
  let off = 0;
  const MAGIC_BYTE = unsignedBin[0];
  if (MAGIC_BYTE !== 0xBE) {
    console.warn("magic byte 不是 0xBE，继续尝试解析（值=" + MAGIC_BYTE + ")");
  }
  off += 1;

  // 跳过 bundleName
  const bundleNameLen = readInt32BE(unsignedBin, off);
  off += 4;
  const bundleName = Buffer.from(unsignedBin.subarray(off, off + bundleNameLen)).toString("utf8");
  off += bundleNameLen;
  console.log("bundleName:", bundleName);

  const hapzip = new JSZip();
  // 继续读取文件条目直到缓冲耗尽
  let fileCount = 0;
  while (off < unsignedBin.length) {
    if (off + 4 > unsignedBin.length) break;
    const fileNameLen = readInt32BE(unsignedBin, off);
    off += 4;
    if (off + fileNameLen > unsignedBin.length) break;
    const fileName = Buffer.from(unsignedBin.subarray(off, off + fileNameLen)).toString("utf8");
    off += fileNameLen;
    // console.log("fileName: ", fileName)

    const relPathLen = readInt32BE(unsignedBin, off);
    off += 4;
    if (off + relPathLen > unsignedBin.length) break;
    const relPath = Buffer.from(unsignedBin.subarray(off, off + relPathLen)).toString("utf8");
    off += relPathLen;
    // console.log("relPath: ", relPath)

    if (off + 8 > unsignedBin.length) break;
    const contentLen = readUInt64BE(unsignedBin, off);
    off += 8;
    if (off + contentLen > unsignedBin.length) break;
    const content = Buffer.from(unsignedBin.subarray(off, off + contentLen));
    off += contentLen;
    // console.log("content: ", content)

    const usePath = (relPath === "") ? fileName : (relPath.replace(/^\//, "") + "/" + fileName);
    hapzip.file(usePath, content);
    fileCount++;
  }
  if (off !== unsignedBin.length) console.error("offset不对应: ", off, unsignedBin.length);

  // 生成 unsigned .hap（zip）并写入文件
  const inDir = path.dirname(inPath);
  const hapNameBase = path.basename(inPath).replace(/\.hap$/i, "");
  const outHapName = path.join(inDir, hapNameBase + ".hap");
  const outAppName = path.join(inDir, hapNameBase + ".app");
  const outP7bName = path.join(inDir, hapNameBase + ".p7b");

  const hapBuffer = await hapzip.generateAsync({ type: "nodebuffer", compression: "STORE" });

  // 把 hap 放进 app
  const appZip = new JSZip();
  appZip.file(path.basename(outHapName), hapBuffer, { binary: true });
  const appBuffer = await appZip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  fs.writeFileSync(outAppName, appBuffer);
  console.log("解析出", outAppName, "，包含", fileCount, "个文件");

  // 写出 p7b
  fs.writeFileSync(outP7bName, p7bBuf);
  console.log("解析出", outP7bName);
}

function readUInt32BE(buf) {
  return (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3];
}

function readUInt16BE(buf, off) {
  return (buf[off] << 8) | buf[off + 1];
}

function readInt32BE(buf, off) {
  return (buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
}

function readUInt64BE(buf, off) {
  const hi = readUInt32BE(Buffer.from([buf[off], buf[off + 1], buf[off + 2], buf[off + 3]]));
  const lo = readUInt32BE(Buffer.from([buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]]));
  return hi * 2 ** 32 + lo;
}