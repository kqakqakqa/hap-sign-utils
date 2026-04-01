@echo off
setlocal enabledelayedexpansion

set /p "inputFile=输入 .app 文件: "
set "inputFile=!inputFile:"=!"

set /p "appCertFile=输入 .cer 文件: "
set "appCertFile=!appCertFile:"=!"

set /p "profileFile=输入 .p7b 文件: "
set "profileFile=!profileFile:"=!"

set /p "keystoreFile=输入 .p12 文件: "
set "keystoreFile=!keystoreFile:"=!"

set /p "pwd=输入 Alias / 密码: "

:: 生成唯一临时目录
set "uuid=%RANDOM%"
set "tmpDir=%TEMP%\hap-sign-!uuid!"
mkdir "!tmpDir!" >nul

:: 获取输出路径
for %%f in ("!inputFile!") do (
  set "outDir=%%~dpf"
  set "outName=%%~nf-signed%%~xf"
)
set "outputFile=!outDir!!outName!"

echo.
echo 正在签名...

:: 在临时目录执行签名
java -jar "%~dp0..\lib\hap-sign-tool.jar" sign-app ^
-mode localSign ^
-keyAlias "!pwd!" ^
-keyPwd "!pwd!" ^
-appCertFile "!appCertFile!" ^
-profileFile "!profileFile!" ^
-inFile "!inputFile!" ^
-inForm zip ^
-signAlg SHA256withECDSA ^
-keystoreFile "!keystoreFile!" ^
-keystorePwd "!pwd!" ^
-outFile "!tmpDir!\signed.app" ^
-signCode 0

if %ERRORLEVEL% equ 0 (
  move /y "!tmpDir!\signed.app" "!outputFile!" >nul
  echo.
  echo 已生成 !outputFile!
  ) else (
  echo.
  echo 签名失败, 请检查输入信息或 Java 环境。
)

rd /s /q "!tmpDir!"

pause
cls
"%~f0"
