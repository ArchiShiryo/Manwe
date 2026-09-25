# Lanceur MANWË (Windows) : met à jour depuis git, installe si besoin, lance
# le service et l'interface, puis ouvre le navigateur.
#   Double-cliquer sur MANWE.cmd, ou :
#   powershell -ExecutionPolicy Bypass -File manwe.ps1 [-Espace nom] [-SansMaj] [-OublierCle]
# La clé DeepSeek n'est jamais écrite dans le dépôt. Si vous acceptez de la
# mémoriser, elle est chiffrée pour votre seul compte Windows (DPAPI) dans
# %LOCALAPPDATA%\ManweNext\deepseek.key.
param(
  [string]$Espace = "personnel",
  [string]$Branche = "claude/happy-knuth-om3xdo",
  [switch]$SansMaj,
  [switch]$OublierCle
)
$ErrorActionPreference = "Stop"
$racine = Split-Path -Parent $MyInvocation.MyCommand.Path
$app = Join-Path $racine "manwe-next"
$donnees = Join-Path $env:LOCALAPPDATA "ManweNext"
$fichierCle = Join-Path $donnees "deepseek.key"
New-Item -ItemType Directory -Force -Path $donnees | Out-Null

function Etape($texte) { Write-Host "`n== $texte" -ForegroundColor Cyan }
function Echec($texte) {
  Write-Host "`n$texte" -ForegroundColor Red
  Read-Host "Appuyez sur Entrée pour fermer"
  exit 1
}

# 1. Prérequis
Etape "Vérification de Node et git"
try { $node = (node -v) } catch { Echec "Node n'est pas installé (22.18 ou plus récent requis : https://nodejs.org)." }
$version = [version]($node.TrimStart("v"))
if ($version -lt [version]"22.18.0") { Echec "Node $node est trop ancien : il faut 22.18 ou plus récent." }
try { git --version | Out-Null } catch { Echec "git n'est pas installé." }
Write-Host "Node $node"

# 2. Mise à jour depuis git
Set-Location $racine
if (-not $SansMaj) {
  Etape "Mise à jour depuis GitHub ($Branche)"
  $modifs = git status --porcelain
  if ($LASTEXITCODE -ne 0) {
    Echec "git refuse ce dossier. S'il parle de « dubious ownership », lancez :`n  git config --global --add safe.directory $($racine -replace '\\','/')"
  }
  if ($modifs) {
    Write-Host "Des modifications locales existent : mise à jour sautée pour ne rien écraser." -ForegroundColor Yellow
  } else {
    git fetch origin $Branche
    if ($LASTEXITCODE -ne 0) { Write-Host "Réseau ou accès GitHub indisponible : on lance la version locale." -ForegroundColor Yellow }
    else {
      $actuelle = (git branch --show-current)
      if ($actuelle -ne $Branche) { git checkout $Branche }
      git merge --ff-only "origin/$Branche"
      if ($LASTEXITCODE -ne 0) { Write-Host "Mise à jour impossible en avance rapide : on lance la version locale." -ForegroundColor Yellow }
    }
  }
  Write-Host ("Version : " + (git log --oneline -1))
}

# 3. Dépendances, seulement si elles ont changé
Set-Location $app
$empreinte = (Get-FileHash (Join-Path $app "package-lock.json")).Hash
$marque = Join-Path $app "node_modules\.manwe-lock"
if (-not (Test-Path $marque) -or (Get-Content $marque -ErrorAction SilentlyContinue) -ne $empreinte) {
  Etape "Installation des dépendances"
  npm install
  if ($LASTEXITCODE -ne 0) { Echec "npm install a échoué." }
  Set-Content -Path $marque -Value $empreinte
}

# 4. Clé DeepSeek : mémorisée chiffrée, ou saisie à chaque lancement
if ($OublierCle -and (Test-Path $fichierCle)) { Remove-Item $fichierCle; Write-Host "Clé oubliée." }
$cle = $null
if ($env:DEEPSEEK_API_KEY) { $cle = $env:DEEPSEEK_API_KEY }
elseif (Test-Path $fichierCle) {
  $secure = Get-Content $fichierCle | ConvertTo-SecureString
  $cle = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
} else {
  Etape "Clé DeepSeek"
  $secure = Read-Host "Collez votre clé DeepSeek (Entrée vide = sans analyse automatique)" -AsSecureString
  $cle = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  if ($cle) {
    $garder = Read-Host "La mémoriser, chiffrée pour votre compte Windows ? (o/N)"
    if ($garder -match "^[oOyY]") { $secure | ConvertFrom-SecureString | Set-Content $fichierCle; Write-Host "Clé mémorisée." }
  }
}

# 5. Espace et fournisseur
$env:MANWE_DATABASE_PATH = Join-Path $donnees "$Espace.sqlite3"
$env:MANWE_WORKSPACE_ID = $Espace
if ($cle) {
  $env:DEEPSEEK_API_KEY = $cle
  $env:MANWE_ANALYST_PROVIDER = "deepseek"
  if (-not $env:MANWE_AGENT_QUIET_MS) { $env:MANWE_AGENT_QUIET_MS = "6000" }
} else {
  Remove-Item Env:MANWE_ANALYST_PROVIDER -ErrorAction SilentlyContinue
  Write-Host "Sans clé : vos notes sont conservées, sans analyse automatique." -ForegroundColor Yellow
}

# 6. Ports libres (un ancien lancement resté ouvert)
Get-NetTCPConnection -LocalPort 5180,5181 -State Listen -ErrorAction SilentlyContinue |
  Where-Object OwningProcess -gt 0 |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

# 7. Lancement, puis ouverture du navigateur dès que l'interface répond
Etape "Lancement de MANWË (espace « $Espace »)"
Write-Host "Gardez cette fenêtre ouverte ; fermez-la pour arrêter MANWË."
Start-Job -ScriptBlock {
  for ($i = 0; $i -lt 60; $i++) {
    try { Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:5180" -TimeoutSec 2 | Out-Null; Start-Process "http://127.0.0.1:5180"; return }
    catch { Start-Sleep -Seconds 1 }
  }
} | Out-Null
npm run dev
