@echo off
chcp 65001 >nul
REM ============================================================
REM  VOW - Bam chay la tu mo local host
REM  Dien duong dan thu muc chua file index.html vao dong duoi
REM  Vi du: set DIST_DIR=D:\vow-local
REM ============================================================
set DIST_DIR=D:\projects\vow

where node >nul 2>nul
if errorlevel 1 (
    echo [LOI] Chua cai Node.js.
    echo Tai ban LTS tai https://nodejs.org roi cai dat, sau do chay lai file nay.
    pause
    exit /b 1
)

if not exist "%DIST_DIR%\index.html" (
    echo [LOI] Khong tim thay file index.html trong:
    echo   %DIST_DIR%
    echo.
    echo Hay chuot phai file .bat nay -^> Edit bang Notepad,
    echo sua lai dong set DIST_DIR=... cho dung thu muc da giai nen.
    pause
    exit /b 1
)

cd /d "%DIST_DIR%"
echo.
echo  ===============================================
echo   VOW local dang chay...
echo   Tren dien thoai (cung WiFi) mo dia chi:
for /f "tokens=*" %%a in ('powershell -noprofile -command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)' } | Select-Object -First 1 -ExpandProperty IPAddress)"') do set MYIP=%%a
if defined MYIP (
    echo   http://%MYIP%:3000
) else (
    echo   http://IP-cua-may-tinh:3000
)
echo  ===============================================
echo  (Nhan Ctrl+C de tat server)
echo.
npx --yes serve -s -l 3000 .
pause
