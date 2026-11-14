@echo off
setlocal enabledelayedexpansion
title Push to GitHub - Livuniq eBay Manager

echo ========================================================
echo        LIVUNIQ EBAY MANAGER - GITHUB PUSH TOOL
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Verify Git Installation
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in PATH!
    echo Please install Git from https://git-scm.com/
    pause
    exit /b 1
)

REM 2. Configure Remote URL
set "REPO_URL=https://github.com/Livuniq/livuniq-ebay-manager.git"
echo [1/5] Checking Git Remote origin...
git remote get-url origin >nul 2>nul
if %errorlevel% neq 0 (
    echo Adding remote origin: %REPO_URL%
    git remote add origin %REPO_URL%
) else (
    echo Updating remote origin: %REPO_URL%
    git remote set-url origin %REPO_URL%
)

REM 3. Set branch to main
git branch -M main

REM 4. Ask for Commit Message
echo.
echo [2/5] Preparing Commit...
set "DEFAULT_MSG=Update Livuniq eBay Manager - $(date /t)"
set /p USER_MSG="Enter commit message (Press Enter for default): "
if "!USER_MSG!"=="" (
    set "COMMIT_MSG=Update Livuniq eBay Manager"
) else (
    set "COMMIT_MSG=!USER_MSG!"
)

echo.
echo [3/5] Staging files (git add .)...
git add .

echo.
echo [4/5] Committing changes...
git commit -m "!COMMIT_MSG!"
if %errorlevel% neq 0 (
    echo (No new changes detected or commit already up to date)
)

echo.
echo [5/5] Pushing to GitHub (origin main)...
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo --------------------------------------------------------
    echo [WARNING] Direct push failed. Trying to pull with rebase
    echo in case remote has commits (e.g. initial README/License)...
    echo --------------------------------------------------------
    git pull origin main --rebase --allow-unrelated-histories
    echo Retrying push...
    git push -u origin main
)

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo [SUCCESS] Code successfully pushed to GitHub!
    echo Repo: %REPO_URL%
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo [FAILED] Push failed. 
    echo Please check your internet connection or GitHub login/PAT.
    echo ========================================================
)

echo.
pause
