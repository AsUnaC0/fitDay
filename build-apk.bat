@echo off
REM ============================================
REM  FitDay one-click APK build script
REM  After editing workoutPlan.ts: npm run build && npx cap sync android, then run this script
REM ============================================
setlocal

set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.13.10002-hotspot"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

echo [1/2] Building APK ...
cd /d "%~dp0android"
call gradlew.bat assembleDebug --no-daemon
if errorlevel 1 (
    echo [ERROR] APK build failed.
    exit /b 1
)

echo [2/2] Copying APK to project root ...
copy /Y "%~dp0android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0FitDay-debug.apk" >nul

echo.
echo ============================================
echo  Build done!
echo  APK: %~dp0FitDay-debug.apk
echo  Copy this file to your Android phone and install it (allow unknown sources).
echo ============================================
endlocal
