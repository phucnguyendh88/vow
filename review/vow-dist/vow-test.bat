@echo off
chcp 65001 >nul
title VOW - Build + Serve + Ngrok (1 click)

:: Dat file nay trong thu muc goc cua project (ngang hang voi package.json)
:: rồi double-click là chạy. Không cần sửa gì thêm.
cd /d "%~dp0"

echo ============================================
echo  VOW - Build + Tao link test dien thoai
echo ============================================
echo.

echo [1/3] Dang build...
call npm run build
if errorlevel 1 (
  echo.
  echo BUILD LOI! Dung lai de kiem tra log o tren.
  pause
  exit /b 1
)
echo Build xong!
echo.

echo [2/3] Dang mo server local cong 3000...
start "VOW Server (cong 3000)" cmd /k "npx -y serve -s dist -l 3000"
timeout /t 4 /nobreak >nul

echo [3/3] Dang tao link ngrok...
start "VOW Ngrok" cmd /k "ngrok http 3000"

echo.
echo ============================================
echo  XONG!
echo  - Lay link https://....ngrok-free.dev
echo    trong cua so "VOW Ngrok"
echo  - Mo link do bang Safari tren iPhone
echo    roi vao tab Khoanh khac test camera
echo.
echo  Muon dung han: tat 2 cua so
echo  "VOW Server" va "VOW Ngrok" la xong.
echo ============================================
pause
