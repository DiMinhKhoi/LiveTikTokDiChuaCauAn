@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Cai Dat Thu Vien - Chua Online TikTok Live

echo =========================================================
echo   CAI DAT THU VIEN TU DONG CHO CHUA ONLINE TIKTOK LIVE
echo =========================================================
echo.

:: 1. Kiem tra Node.js va npm
echo [*] Buoc 1/2: Kiem tra Node.js va cai dat thu vien Node...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] May tinh cua ban chua cai dat Node.js!
    echo Vui long vao https://nodejs.org de tai va cai dat Node.js truoc.
    echo.
    pause
    exit /b
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay npm! Vui long kiem tra lai Node.js.
    echo.
    pause
    exit /b
)

echo [+] Dang chay "npm install" de cai cac goi can thiet...
call npm install
if %errorlevel% neq 0 (
    echo [CANH BAO] Co loi khi chay npm install. Dang thu cai dat truc tiep...
    call npm install express socket.io cors tiktok-live-connector ws
)
echo [+] Cai dat thu vien Node.js thanh cong!
echo.

:: 2. Kiem tra Python va pip (ho tro gTTS tao giong doc Tieng Viet)
echo [*] Buoc 2/2: Kiem tra Python de cai gTTS (Giong doc Tieng Viet)...

set "PYTHON_CMD="
where python >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python"
) else (
    where py >nul 2>&1
    if %errorlevel% equ 0 (
        set "PYTHON_CMD=py"
    )
)

if not defined PYTHON_CMD (
    echo [-] Khong tim thay Python. Dang tu dong tai va cai dat Python 3.11...
    set "PY_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    set "PY_INSTALLER=%TEMP%\python_installer.exe"
    
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('!PY_URL!', '!PY_INSTALLER!')"
    
    if exist "!PY_INSTALLER!" (
        echo [*] Dang cai dat Python ngam vao may...
        start /wait "" "!PY_INSTALLER!" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_test=0 SimpleInstall=1
        del /f /q "!PY_INSTALLER!" >nul 2>&1
        
        set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%PATH%"
        set "PATH=C:\Program Files\Python311;C:\Program Files\Python311\Scripts;%PATH%"
        
        where python >nul 2>&1
        if %errorlevel% equ 0 (
            set "PYTHON_CMD=python"
        ) else (
            where py >nul 2>&1
            if %errorlevel% equ 0 (
                set "PYTHON_CMD=py"
            )
        )
    )
)

if defined PYTHON_CMD (
    echo [+] Da tim thay Python. Dang kiem tra va cai dat goi "gTTS"...
    !PYTHON_CMD! -m pip install --upgrade gTTS >nul 2>&1
    if %errorlevel% equ 0 (
        echo [+] Cai dat thu vien gTTS Tieng Viet thanh cong!
    ) else (
        echo [-] Cai dat gTTS khong thanh cong hoac pip chua san sang.
    )
) else (
    echo [-] Chua cai dat duoc Python. Ung dung van chay duoc cac tinh nang khac.
)

echo.
echo =========================================================
echo   HOAN TAT! TAT CA THU VIEN DA DUOC CAI DAT XONG.
echo   Bay gio ban co the chay "start_app.bat" de mo ung dung.
echo =========================================================
echo.
pause
