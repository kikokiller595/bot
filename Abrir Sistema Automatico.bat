@echo off
setlocal

cd /d "%~dp0"
title TBY Sistemas - Inicio Automatico

echo.
echo ==========================================
echo   TBY Sistemas - Inicio Automatico
echo ==========================================
echo.
echo Iniciando revision, instalacion y apertura automatica...
powershell -NoProfile -ExecutionPolicy Bypass -File ".\sistema.ps1" auto
if errorlevel 1 goto :error

echo.
echo El sistema se esta iniciando.
goto :end

:error
echo.
echo No se pudo completar el arranque automatico.
echo Revisa los mensajes anteriores.
pause
exit /b 1

:end
echo.
pause
endlocal
