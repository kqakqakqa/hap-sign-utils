import fs from "fs";
import path from "path";
import crypto from "crypto";

import jsrsasign from "jsrsasign";
import JsZip from "jszip";

const p12Pem = "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgBCsp9yrXDMGvvKib\nUddAWZEqNGZmyELWeaJM19FbjGmhRANCAAR1VIBWnhZckS1Xr/GvhEpgr+HpSdlP\n48szkRw5xes+5+D2pAXts0OrsXQ4Y0u/RIWqF7oF7tAtSt92rlhsGUSL\n-----END PRIVATE KEY-----";
const cerRoot = "-----BEGIN CERTIFICATE-----\nMIICGjCCAaGgAwIBAgIIShhpn519jNAwCgYIKoZIzj0EAwMwUzELMAkGA1UEBhMC\nQ04xDzANBgNVBAoMBkh1YXdlaTETMBEGA1UECwwKSHVhd2VpIENCRzEeMBwGA1UE\nAwwVSHVhd2VpIENCRyBSb290IENBIEcyMB4XDTIwMDMxNjAzMDQzOVoXDTQ5MDMx\nNjAzMDQzOVowUzELMAkGA1UEBhMCQ04xDzANBgNVBAoMBkh1YXdlaTETMBEGA1UE\nCwwKSHVhd2VpIENCRzEeMBwGA1UEAwwVSHVhd2VpIENCRyBSb290IENBIEcyMHYw\nEAYHKoZIzj0CAQYFK4EEACIDYgAEWidkGnDSOw3/HE2y2GHl+fpWBIa5S+IlnNrs\nGUvwC1I2QWvtqCHWmwFlFK95zKXiM8s9yV3VVXh7ivN8ZJO3SC5N1TCrvB2lpHMB\nwcz4DA0kgHCMm/wDec6kOHx1xvCRo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0T\nAQH/BAUwAwEB/zAdBgNVHQ4EFgQUo45a9Vq8cYwqaiVyfkiS4pLcIAAwCgYIKoZI\nzj0EAwMDZwAwZAIwMypeB7P0IbY7c6gpWcClhRznOJFj8uavrNu2PIoz9KIqr3jn\nBlBHJs0myI7ntYpEAjBbm8eDMZY5zq5iMZUC6H7UzYSix4Uy1YlsLVV738PtKP9h\nFTjgDHctXJlC5L7+ZDY=\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIIDATCCAoigAwIBAgIIXmuDXbWpOB8wCgYIKoZIzj0EAwMwUzELMAkGA1UEBhMC\nQ04xDzANBgNVBAoMBkh1YXdlaTETMBEGA1UECwwKSHVhd2VpIENCRzEeMBwGA1UE\nAwwVSHVhd2VpIENCRyBSb290IENBIEcyMB4XDTIwMDcwOTAyMDQyNFoXDTMwMDcw\nNzAyMDQyNFowYjELMAkGA1UEBgwCQ04xDzANBgNVBAoMBkh1YXdlaTETMBEGA1UE\nCwwKSHVhd2VpIENCRzEtMCsGA1UEAwwkSHVhd2VpIENCRyBEZXZlbG9wZXIgUmVs\nYXRpb25zIENBIEcyMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE65LdoIZh1hlpZ2gP\nbJ6gPhHsvYSRe22KETgdqeVeYnrbRHI9wsPT6RGYS+pU4mPl6wxzgDMqN6SY/BoZ\nluhkE1PzaHoPoNIWIq0O33hpyKyyYwAacIUEjYurkw1E9r9no4IBGDCCARQwHwYD\nVR0jBBgwFoAUo45a9Vq8cYwqaiVyfkiS4pLcIAAwHQYDVR0OBBYEFNtek7Ij6NDk\n/nF6Zumkc0dbf/NeMEYGA1UdIAQ/MD0wOwYEVR0gADAzMDEGCCsGAQUFBwIBFiVo\ndHRwOi8vY3BraS1jYXdlYi5odWF3ZWkuY29tL2Nwa2kvY3BzMBIGA1UdEwEB/wQI\nMAYBAf8CAQAwDgYDVR0PAQH/BAQDAgEGMGYGA1UdHwRfMF0wW6BZoFeGVWh0dHA6\nLy9jcGtpLWNhd2ViLmh1YXdlaS5jb20vY3BraS9zZXJ2bGV0L2NybEZpbGVEb3du\nLmNybD9jZXJ0eXBlPTEwJi9yb290X2cyX2NybC5jcmwwCgYIKoZIzj0EAwMDZwAw\nZAIwWO1X5q2MdfpR1Q237GpUHGbL1C13rGyFg2p3AYo44FpZ2/A9ss0wOHKM4KDl\nZPqdAjBLkf8NPZy7KVog98+iCTLq35DJ2ZVxkCxknA9YhiHVyXf4HPm4JlT7rW7o\nQ+FzM3c=\n-----END CERTIFICATE-----\n";

async function signHap(appBuffer, p7bBuffer) {

  // 解析 p7b
  const p7bHex = p7bBuffer.toString("hex");
  const p7bParser = new jsrsasign.KJUR.asn1.cms.CMSParser();
  const p7bEContentHex = p7bParser.getCMSSignedData(p7bHex).econtent.content.hex;
  const p7bEContent = JSON.parse(Buffer.from(p7bEContentHex, "hex").toString());

  const bundleName = p7bEContent["bundle-info"]["bundle-name"];
  const signTime = p7bEContent.validity["not-before"];
  const signTimeStr = getTimeStr(new Date(signTime * 1000)) + "Z";
  const cerLeaf = p7bEContent["bundle-info"]["development-certificate"];
  const cerStr = cerRoot + cerLeaf;

  // 解压并处理
  const appLoad = await JsZip.loadAsync(appBuffer);
  const hapEntry = Object.values(appLoad.files).find(f => f.name.endsWith(".hap"));
  if (!hapEntry) throw new Error(".app 文件格式不正确：没有找到 .hap 文件");

  const hapBuffer = await hapEntry.async("nodebuffer");
  const hapLoad = await JsZip.loadAsync(hapBuffer);

  // 修改 config.json
  const configStr = await hapLoad.file("config.json").async("text");
  const config = JSON.parse(configStr);
  config.app.bundleName = bundleName;
  config.app.version.code = 0;
  hapLoad.file("config.json", JSON.stringify(config));

  // 转换 & 签名
  const unsignedBin = await hapToBin(hapLoad, bundleName);
  const signedBin = await signBin({
    unsignedBin,
    p7bUint8Array: new Uint8Array(p7bBuffer),
    p12Pem: p12Pem,
    cerStr,
    signTimeStr
  });

  // 打包最终 HAP
  const signedHap = new JsZip();
  signedHap.file("signed.bin", signedBin, { binary: true, compression: "STORE" });
  const outputBuffer = await signedHap.generateAsync({ type: "nodebuffer" });

  return outputBuffer;
}

async function hapToBin(hapLoad, bundleName) {
  const parts = [];
  parts.push(Buffer.from([0xBE])); // Magic

  const bundleNameBytes = Buffer.from(bundleName);
  parts.push(makeInt32BE(bundleNameBytes.length));
  parts.push(bundleNameBytes);

  const sortedEntries = Object.entries(hapLoad.files)
    .filter(([path, entry]) => !entry.dir)
    .sort((a, b) => {
      const depthA = a[0].split("/").length;
      const depthB = b[0].split("/").length;
      if (depthA !== depthB) return depthA - depthB;
      return a[0].localeCompare(b[0]);
    });

  for (const [fullPath, zipEntry] of sortedEntries) {
    if (zipEntry.dir) continue;

    const content = await zipEntry.async("nodebuffer");
    const fileName = path.posix.basename(fullPath);
    let relPath = path.posix.dirname(fullPath);
    relPath = relPath === "." ? "" : "/" + relPath;

    const fnBytes = Buffer.from(fileName);
    const rpBytes = Buffer.from(relPath);

    parts.push(makeInt32BE(fnBytes.length), fnBytes);
    parts.push(makeInt32BE(rpBytes.length), rpBytes);
    parts.push(makeInt64BE(content.length), content);
  }
  return Buffer.concat(parts);
}

async function signBin({ unsignedBin, p7bUint8Array, p12Pem, cerStr, signTimeStr }) {
  const unsignedBinLen = unsignedBin.length;
  const p7bLen = p7bUint8Array.length;
  const offsetProBlock = unsignedBinLen + 8 + 8;
  const offsetSignBlock = offsetProBlock + p7bLen;

  const proBlock = getBlockHead(0x02, 0x00, p7bLen, offsetProBlock);
  const signBlock = getBlockHead(0x00, 0x00, 0, offsetSignBlock);

  const bytes = Buffer.concat([unsignedBin, proBlock, signBlock, Buffer.from(p7bUint8Array)]);
  const hash = await slicedSHA256(bytes);
  const hashBlock = getByteContent(hash);

  const signedData = await generateSignedData({ data: hashBlock, p12Pem, cerStr, signTimeStr });
  const bytes2 = Buffer.concat([bytes, signedData]);

  const size = bytes2.length - unsignedBinLen + 32;
  const signHead = getSignHead(size);

  return Buffer.concat([bytes2, signHead]);
}

function getBlockHead(type, tag, len, offset) {
  const b = Buffer.alloc(8);
  b[0] = type; b[1] = tag;
  b.writeUInt16BE(len, 2);
  b.writeUInt32BE(offset, 4);
  return b;
}

function getByteContent(inBytes) {
  const dataLen = inBytes.length;
  const size = 16 + dataLen;
  const head = Buffer.from([0x31, 0x30, 0x30, 0x30, 0, 0, 0x00, 0x01, 0x00, 0x88, 0x00, 0x06, 0, 0, 0, 0]);
  head.writeUInt16BE(size, 4);
  head.writeUInt32BE(dataLen, 12);
  return Buffer.concat([head, inBytes]);
}

function getSignHead(subBlockSize) {
  const head = Buffer.alloc(32);
  head.write("hw signed app   ", 0);
  head.write("1000", 16);
  head.writeUInt32BE(subBlockSize, 20);
  head.writeUInt32BE(0x02, 24); // type
  return head;
}

async function generateSignedData({ data, p12Pem, cerStr, signTimeStr }) {
  const certs = sortCerts(cerStr.trim().split(/(?=-----BEGIN CERTIFICATE-----)/).map(s => s.trim()));
  const sd = new jsrsasign.KJUR.asn1.cms.SignedData({
    version: 1,
    hashalgs: ["sha256"],
    econtent: { type: "data", content: { hex: data.toString("hex") } },
    certs: certs,
    revinfos: { array: [] },
    sinfos: [{
      version: 1,
      id: { type: "isssn", cert: certs[0] },
      hashalg: "sha256",
      sattrs: {
        array: [
          { attr: "signingTime", type: new jsrsasign.KJUR.asn1.cms.SigningTime(signTimeStr) },
          { attr: "contentType", type: "1.2.840.113549.1.7.1" },
          { attr: "messageDigest", hex: crypto.createHash("sha256").update(data).digest("hex") }
        ]
      },
      sigalg: "SHA256withECDSA",
      signkey: p12Pem
    }]
  });
  return Buffer.from(sd.getContentInfoEncodedHex(), "hex");
}

function sortCerts(certs) {
  // 解析 subject issuer
  const cert = certs.map(pem => {
    const c = new jsrsasign.X509();
    c.readCertPEM(pem);
    return {
      pem,
      subject: c.getSubjectString(),
      issuer: c.getIssuerString()
    };
  });

  // 找叶子证书
  const leaf = cert.find(c => !cert.some(x => x.issuer === c.subject));
  if (!leaf) throw new Error("找不到叶子证书");

  // 排序
  const ordered = [];
  let current = leaf;
  while (current) {
    ordered.push(current.pem);
    if (current.subject === current.issuer) break; // 根证书
    current = cert.find(x => x.subject === current.issuer);
  }

  return ordered;
}

async function slicedSHA256(buffer) {
  const chunkSize = 4096;
  const hashes = [];
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.slice(i, i + chunkSize);
    hashes.push(crypto.createHash("sha256").update(chunk).digest());
  }
  return crypto.createHash("sha256").update(Buffer.concat(hashes)).digest();
}

function makeInt32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
}

function makeInt64BE(n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(n));
  return b;
}

function getTimeStr(d = new Date()) {
  return d.toISOString().replace(/[-:T]/g, "").split(".")[0];
}

export { signHap };

if (process.argv[1] === import.meta.filename) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("用法: node sign-app-to-hap.js <input.app> <input.p7b> [output.hap]");
    process.exit(1);
  }

  const appPath = args[0];
  const p7bPath = args[1];
  const outPath = args[2] || path.join(path.dirname(appPath), path.basename(appPath, ".app") + ".hap");

  console.log("正在签名");

  signHap(fs.readFileSync(appPath), fs.readFileSync(p7bPath))
    .then(buffer => {
      fs.writeFileSync(outPath, buffer);
      console.log(`签名完成：${outPath}`);
    })
    .catch(err => {
      console.error("签名失败：", err.message);
      process.exit(1);
    });
}