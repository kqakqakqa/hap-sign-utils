import fs from "fs";
import path from "path";
import JSZip from "jszip";

// 导出函数
export { mergeApps };

// 读取ZIP中文件内容（内存操作）
async function readZipEntry(zip, entryPath) {
  const entry = zip.file(entryPath);
  if (!entry) throw new Error(`ZIP中未找到: ${entryPath}`);
  const content = await entry.async('nodebuffer');
  return content;
}

// 读取ZIP中JSON文件
async function readZipJson(zip, entryPath) {
  const buf = await readZipEntry(zip, entryPath);
  return JSON.parse(buf.toString('utf8'));
}

// 合并pack.info文件
function mergePackInfo(actualPackInfo, shellPackInfo) {
  const merged = JSON.parse(JSON.stringify(shellPackInfo));
  merged.summary.app.bundleName = actualPackInfo.summary.app.bundleName;
  merged.summary.app.version = actualPackInfo.summary.app.version;
  const actualPackages = actualPackInfo.packages;
  if (actualPackages && actualPackages.length > 0) {
    merged.packages = [...merged.packages, ...actualPackages];
  }
  return merged;
}

// 更新壳hap的内容：修改pack.info和module.json，返回更新后的ZIP buffer
async function updateShellHap(shellHapBuffer, bundleName, version) {
  const zip = await JSZip.loadAsync(shellHapBuffer);

  // 读/改 pack.info
  const packInfo = JSON.parse((await readZipEntry(zip, 'pack.info')).toString('utf8'));
  packInfo.summary.app.bundleName = bundleName;
  packInfo.summary.app.version = version;
  zip.file('pack.info', JSON.stringify(packInfo, null, 4));

  // 读/改 module.json
  const moduleJson = JSON.parse((await readZipEntry(zip, 'module.json')).toString('utf8'));
  moduleJson.app.bundleName = bundleName;
  moduleJson.app.versionName = version.name;
  moduleJson.app.versionCode = version.code;
  zip.file('module.json', JSON.stringify(moduleJson, null, 4));

  // 重新生成ZIP（存储模式，不压缩）
  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'STORE',
    compressionOptions: { level: 0 }
  });
}

// 主合并函数 - 完全内存操作，不创建临时文件
async function mergeApps(actualAppPath, shellAppPath, outputAppPath) {
  console.log('开始合并app包...');

  try {
    // 检查文件是否存在
    if (!fs.existsSync(actualAppPath)) {
      throw new Error(`实际应用app文件不存在: ${actualAppPath}`);
    }
    if (!fs.existsSync(shellAppPath)) {
      throw new Error(`壳app文件不存在: ${shellAppPath}`);
    }

    // 读取两个app包到内存
    const actualAppBuffer = fs.readFileSync(actualAppPath);
    const shellAppBuffer = fs.readFileSync(shellAppPath);

    // 解压到内存（JSZip对象）
    console.log('解压实际应用app...');
    const actualZip = await JSZip.loadAsync(actualAppBuffer);
    console.log('解压壳app...');
    const shellZip = await JSZip.loadAsync(shellAppBuffer);

    // 读取pack.info
    const actualPackInfo = await readZipJson(actualZip, 'pack.info');
    const shellPackInfo = await readZipJson(shellZip, 'pack.info');

    console.log('实际应用包名:', actualPackInfo.summary.app.bundleName);
    console.log('实际应用版本:', actualPackInfo.summary.app.version.name);
    console.log('壳应用包名:', shellPackInfo.summary.app.bundleName);
    console.log('壳应用版本:', shellPackInfo.summary.app.version.name);

    // 合并pack.info
    console.log('合并pack.info文件...');
    const mergedPackInfo = mergePackInfo(actualPackInfo, shellPackInfo);

    // 从实际app中读取hap
    console.log('读取实际应用的hap文件...');
    const actualHapBuffer = await readZipEntry(actualZip, 'entry-release-lite.hap');

    // 从壳app中读取hap
    console.log('读取壳app的hap文件...');
    const shellHapBuffer = await readZipEntry(shellZip, 'entry-default.hap');

    // 更新壳hap内容（内存中修改pack.info和module.json）
    console.log('更新壳hap的pack.info和module.json...');
    const updatedShellHapBuffer = await updateShellHap(
      shellHapBuffer,
      actualPackInfo.summary.app.bundleName,
      actualPackInfo.summary.app.version
    );

    // 在内存中组装最终app
    console.log('组装最终app包...');
    const finalZip = new JSZip();
    finalZip.file('entry-release-lite.hap', actualHapBuffer);
    finalZip.file('entry-default.hap', updatedShellHapBuffer);
    finalZip.file('pack.info', JSON.stringify(mergedPackInfo, null, 4));

    // 生成最终app包（存储模式）
    const finalAppBuffer = await finalZip.generateAsync({
      type: 'nodebuffer',
      compression: 'STORE',
      compressionOptions: { level: 0 }
    });

    // 写入输出文件
    fs.writeFileSync(outputAppPath, finalAppBuffer);
    console.log('合并完成！输出文件:', outputAppPath);

    return outputAppPath;

  } catch (error) {
    console.error('合并过程中出错:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// 命令行调用支持
if (process.argv[1] === import.meta.filename) {
  // 解析命令行参数
  const args = process.argv.slice(2);

  // 使用默认路径或命令行参数
  const actualAppPath = args[0];
  const shellAppPath = args[1];
  const outputAppPath = args[2];

  if (!(actualAppPath && shellAppPath && outputAppPath)) {
    console.log("usage: app-to-shell-app.js actualAppPath shellAppPath outputAppPath")
    process.exit(1);
  }

  mergeApps(actualAppPath, shellAppPath, outputAppPath).catch(error => {
    console.error('程序执行失败:', error);
    process.exit(1);
  });
}