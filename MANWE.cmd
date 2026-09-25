@echo off
rem Double-cliquer pour mettre à jour MANWË depuis git et le lancer.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0manwe.ps1" %*
