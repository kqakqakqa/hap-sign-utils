import fs from "fs";
import path from "path";

import stream from "stream";
import basicftp from "basic-ftp";

import { signHap } from "./sign-app-to-hap.js";

const [appPath, p7bPath, outDir] = process.argv.slice(2);

if (!appPath || !p7bPath || !outDir) {
  console.log("用法: node auto-sign-app-to-hap.js <input.app> <input.p7b> <target_path>");
  process.exit(1);
}

const isFtp = outDir.startsWith("ftp://");
let signing = false;

const fileName = path.basename(appPath, ".app") + ".hap";

let outPath;
if (isFtp) {
  outPath = outDir.endsWith('/') ? (outDir + fileName) : (outDir + '/' + fileName);
} else {
  outPath = path.join(outDir, fileName);
}

async function handleSign() {
  if (signing) {
    console.log("已有更新正在处理，跳过本次触发");
    return;
  }

  signing = true;
  try {
    if (!fs.existsSync(appPath)) {
      console.log("文件不存在", appPath);
      return;
    }
    if (fs.statSync(appPath).size === 0) {
      console.log("文件大小为 0");
      return;
    }

    const appBuffer = fs.readFileSync(appPath);
    const p7bBuffer = fs.readFileSync(p7bPath);

    console.log("[", new Date().toLocaleTimeString(), "] 检测到更新");

    const hapBuffer = await signHap(appBuffer, p7bBuffer);

    if (isFtp) {
      await uploadToFtp(hapBuffer, outPath);
    } else {
      fs.writeFileSync(outPath, hapBuffer);
    }

    console.log("更新完成：", outPath);

  } catch (err) {
    console.error("更新失败：", err.code, err.message);
  } finally {
    signing = false;
  }
}

async function uploadToFtp(buffer, url) {
  const ftpUrl = new URL(url);
  const client = new basicftp.Client(30000);

  try {
    await client.access({
      host: ftpUrl.hostname,
      port: parseInt(ftpUrl.port) || 21,
      user: "anonymous",
      password: "",
    });

    const remotePath = decodeURIComponent(ftpUrl.pathname);
    const remoteDir = path.posix.dirname(remotePath);

    await client.ensureDir(remoteDir);
    const remoteName = path.posix.basename(remotePath);
    const totalBytes = buffer.length;
    let progressStarted = false;

    client.trackProgress(info => {
      if (info.type !== "upload") {
        return;
      }

      progressStarted = true;
      const percent = totalBytes === 0 ? 100 : Math.min(100, info.bytes / totalBytes * 100);
      const width = 24;
      const filled = Math.round(percent / 100 * width);
      const bar = "#".repeat(filled) + ".".repeat(width - filled);
      process.stdout.write(`\r上传 ${remoteName} [${bar}] ${percent.toFixed(1)}% ${formatBytes(info.bytes)}/${formatBytes(totalBytes)}`);
    });

    try {
      await client.uploadFrom(stream.Readable.from(buffer), remotePath);
    } finally {
      client.trackProgress();
      if (progressStarted) {
        process.stdout.write("\n");
      }
    }

    console.log("上传 FTP：", ftpUrl.pathname);

  } finally {
    client.close();
  }
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

console.log("开始检测：", appPath);

console.log("按下 Enter 可手动触发签名，按下 Ctrl+C 可退出");

fs.watchFile(appPath, { interval: 1000 }, (curr, prev) => {
  if (curr.mtimeMs > prev.mtimeMs && curr.mtimeMs !== 0) handleSign();
});

handleSign(); // 启动时先跑一次

process.stdin.setEncoding('utf8');

process.stdin.on('data', () => {
  handleSign();
});

// Ctrl+C 退出
process.on('SIGINT', () => {
  process.exit();
});
