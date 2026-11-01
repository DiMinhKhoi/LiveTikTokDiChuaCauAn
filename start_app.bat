@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Chua Online TikTok Live - Di Chua Cau An

echo =========================================================
echo   KHOI DONG UNG DUNG CHUA ONLINE TIKTOK LIVE
echo =========================================================
echo.

:: 1. Kiem tra Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] May tinh cua ban chua cai dat Node.js!
    echo Vui long truy cap https://nodejs.org de tai va cai dat Node.js truoc.
    echo.
    pause
    exit /b
)

:: Tu dong kiem tra va cai dat thu vien neu chua co node_modules
if not exist "node_modules\" (
    echo [*] Phat hien chua cai dat thu vien. Dang tu dong cai dat...
    call npm install
    echo [+] Cai dat thu vien hoan tat!
    echo.
)

:: 2. Giai phong cong 3000 neu co tien trinh cu dang chay
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: 3. Thong bao duong dan
echo [*] Man hinh Live (OBS / TikTok Live Studio): http://localhost:3000/index.html
echo [*] Bang Dieu Khien (Admin Panel): http://localhost:3000/admin.html
echo.
echo [*] Dang khoi dong server va mo trinh duyet...

:: 4. Mo trinh duyet sau 1 giay
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000/admin.html & start http://localhost:3000/index.html"

:: 5. Chay Node Server
echo.
echo =========================================================
echo   SERVER DANG CHAY. GIU NGUYEN CUA SO NAY KHI LIVESTREAM.
echo   Nhan Ctrl+C hoac dong cua so nay de tat server.
echo =========================================================
echo.
node server.js
echo.
echo Server da dung hoac duoc khoi dong lai. Nhan phim bat ky de thoat...
pause >nul