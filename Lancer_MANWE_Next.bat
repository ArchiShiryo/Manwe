@echo off
setlocal
title MANWE Next - Interface locale
cd /d "%~dp0manwe-next"
if errorlevel 1 goto missing_project

where node >nul 2>&1
if errorlevel 1 goto missing_node
where npm >nul 2>&1
if errorlevel 1 goto missing_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 goto missing_node

if exist "node_modules\vite\bin\vite.js" goto dependencies_ready
echo Installation des dependances de MANWE Next...
call npm ci
if errorlevel 1 goto failed

:dependencies_ready
if /i "%~1"=="--check" goto check
powershell -NoProfile -Command "try { $ui = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5180/' -TimeoutSec 2; $memory = Invoke-RestMethod -Uri 'http://127.0.0.1:5181/api/health' -TimeoutSec 2; if (($ui.Content -match 'MANWE Next') -and ($memory.status -eq 'ok')) { exit 0 } } catch {}; exit 1" >nul 2>&1
if errorlevel 1 goto launch
start "" "http://127.0.0.1:5180/"
exit /b 0

:launch
echo MANWE Next - interface et memoire locales
echo Interface : http://127.0.0.1:5180/
echo Memoire   : http://127.0.0.1:5181/
echo L'espace personnel utilise SQLite. DeepSeek n'est pas encore connecte.
echo Gardez cette fenetre ouverte. Ctrl+C arrete les deux services.
echo.
call npm run dev -- --open
if errorlevel 1 goto failed
exit /b 0

:check
call npm run build
if errorlevel 1 exit /b 1
call npm test
exit /b %errorlevel%

:missing_project
echo Dossier manwe-next introuvable a cote de ce lanceur.
pause
exit /b 1

:missing_node
echo Node.js 24 ou plus recent avec npm est necessaire.
echo Installez-le depuis https://nodejs.org puis relancez ce fichier.
pause
exit /b 1

:failed
echo.
echo Le lancement a echoue. Consultez le message ci-dessus.
echo Si les ports 5180 ou 5181 sont occupes, fermez les serveurs concernes puis relancez.
pause
exit /b 1
