# Sistem Tempahan Bilik Khas - deploy automatik (Windows)
#
#   1. Google Apps Script : cipta projek + Google Sheet platform, push kod, deploy Web App
#   2. Firebase Hosting   : isi config.js dan .firebaserc, kemudian firebase deploy
#
# Jalankan dengan klik dua kali deploy.bat. Selamat dijalankan semula untuk kemas kini:
# URL Web App dan projek Firebase yang sama akan digunakan semula.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot          # ...\firebase-gas
$StateFile = Join-Path $PSScriptRoot 'deploy-state.json'
$ClaspVersion = '2.4.2'

function Say($msg, $color = 'Cyan') { Write-Host ''; Write-Host "==> $msg" -ForegroundColor $color }
function Info($msg) { Write-Host "    $msg" }
function Fail($msg) { Write-Host ''; Write-Host "RALAT: $msg" -ForegroundColor Red; Read-Host 'Tekan Enter untuk tutup'; exit 1 }
function Pause-Enter($msg) { Read-Host "    $msg (tekan Enter)" | Out-Null }
function Write-NoBom($path, $text) { [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false))) }
function Run($exe, [string[]]$argv) {
    & $exe @argv
    if ($LASTEXITCODE -ne 0) { Fail "$exe $($argv -join ' ') gagal (kod $LASTEXITCODE)." }
}

$state = @{}
if (Test-Path $StateFile) {
    (Get-Content $StateFile -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $state[$_.Name] = $_.Value }
}
function Save-State { Write-NoBom $StateFile ($state | ConvertTo-Json) }

Set-Location $Root
Write-Host '=============================================================' -ForegroundColor White
Write-Host '  Sistem Tempahan Bilik Khas - Deploy (Apps Script + Firebase)' -ForegroundColor White
Write-Host '=============================================================' -ForegroundColor White

# ---------------------------------------------------------------- 0. Alat
Say 'Semak Node.js'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Info 'Node.js tiada. Memasang Node.js LTS melalui winget...'
        winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        Write-Host ''
        Write-Host 'Node.js dipasang. TUTUP tetingkap ini dan klik dua kali deploy.bat sekali lagi.' -ForegroundColor Yellow
        Read-Host 'Tekan Enter untuk tutup'; exit 0
    }
    Start-Process 'https://nodejs.org/'
    Fail 'Node.js tiada. Pasang versi LTS dari https://nodejs.org, kemudian jalankan deploy.bat semula.'
}
Info ('Node.js ' + (node --version))

Say 'Pasang/kemas kini alat (firebase-tools, clasp)'
if (-not (Get-Command firebase.cmd -ErrorAction SilentlyContinue)) { Run 'npm.cmd' @('install', '-g', 'firebase-tools') } else { Info 'firebase-tools sudah ada.' }
$claspOk = $false
if (Get-Command clasp.cmd -ErrorAction SilentlyContinue) { $claspOk = ((& clasp.cmd --version) -match [regex]::Escape($ClaspVersion)) }
if (-not $claspOk) { Run 'npm.cmd' @('install', '-g', "@google/clasp@$ClaspVersion") } else { Info 'clasp sudah ada.' }

# ---------------------------------------------------------------- 1. Apps Script
Say 'LANGKAH 1: Google Apps Script'
$claspRc = Join-Path $env:USERPROFILE '.clasprc.json'
if (-not (Test-Path $claspRc)) {
    Info 'Hidupkan "Google Apps Script API" untuk akaun Google anda:'
    Info '  halaman tetapan akan dibuka -> tukar suis kepada ON.'
    Start-Process 'https://script.google.com/home/usersettings'
    Pause-Enter 'Selepas suis ON'
    Info 'Log masuk Google untuk Apps Script (pelayar akan dibuka, klik Allow)...'
    Run 'clasp.cmd' @('login')
}

Info 'Menjana fail Apps Script terkini...'
Run 'node' @('tools/build-gas.js')

if (-not (Test-Path (Join-Path $Root '.clasp.json'))) {
    Info 'Mencipta Google Sheet "Platform Tempahan Bilik" dan projek Apps Script...'
    # Created in a temporary folder: clasp writes a default appsscript.json there, which must not
    # overwrite ours (web app settings + Malaysian time zone).
    $tmp = Join-Path $env:TEMP ('tb-clasp-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    Push-Location $tmp
    $out = & clasp.cmd create --type sheets --title 'Platform Tempahan Bilik' 2>&1 | Out-String
    Pop-Location
    Write-Host $out
    $tmpClasp = Join-Path $tmp '.clasp.json'
    if (-not (Test-Path $tmpClasp)) {
        if ($out -match 'Apps Script API') { Start-Process 'https://script.google.com/home/usersettings'; Fail 'Apps Script API belum dihidupkan. Tukar suis kepada ON, tunggu 1 minit, kemudian jalankan semula.' }
        Fail 'Projek Apps Script tidak dapat dicipta.'
    }
    $scriptId = (Get-Content $tmpClasp -Raw | ConvertFrom-Json).scriptId
    Write-NoBom (Join-Path $Root '.clasp.json') ("{`"scriptId`":`"$scriptId`",`"rootDir`":`"gas`"}")
    Remove-Item -Recurse -Force $tmp
    if ($out -match '(https://drive\.google\.com/open\?id=[\w-]+)') { $state.sheet_url = $Matches[1] }
    $state.script_url = "https://script.google.com/d/$scriptId/edit"
    Save-State
}

Info 'Menghantar kod ke Apps Script...'
Run 'clasp.cmd' @('push', '--force')

$desc = 'Deploy ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
if ($state.deployment_id) {
    Info 'Mengemas kini Web App sedia ada (URL kekal sama)...'
    $out = & clasp.cmd deploy -i $state.deployment_id -d $desc 2>&1 | Out-String
} else {
    Info 'Deploy Web App baharu...'
    $out = & clasp.cmd deploy -d $desc 2>&1 | Out-String
}
Write-Host $out
if ($out -notmatch '(AKfy[\w-]{20,})') { Fail 'Deploy Web App gagal. Lihat mesej di atas.' }
$state.deployment_id = $Matches[1]
$gasUrl = "https://script.google.com/macros/s/$($state.deployment_id)/exec"
Save-State
Info "URL Web App: $gasUrl"

if (-not $state.authorized) {
    Write-Host ''
    Write-Host '    PENTING - benarkan akses (sekali sahaja):' -ForegroundColor Yellow
    Info '    URL Web App akan dibuka. Jika diminta:'
    Info '    Review permissions -> pilih akaun anda -> Advanced -> Go to ... (unsafe) -> Allow'
    Info '    ("unsafe" dipaparkan kerana skrip ini milik anda sendiri dan belum disemak Google.)'
    Start-Process $gasUrl
    Pause-Enter 'Selepas anda nampak halaman "Masukkan kod sekolah"'
    $state.authorized = $true; Save-State
}

# ---------------------------------------------------------------- 2. Firebase
Say 'LANGKAH 2: Firebase Hosting'
Write-NoBom (Join-Path $Root 'public\config.js') ("/* Dijana oleh deploy/deploy.ps1 */`nwindow.APP_CONFIG = {`n  gasUrl: '$gasUrl',`n};`n")
Info 'public/config.js dikemas kini.'

Info 'Log masuk Firebase (pelayar akan dibuka jika perlu)...'
Run 'firebase.cmd' @('login')

if (-not $state.firebase_project) {
    Info 'Projek Firebase anda:'
    & firebase.cmd projects:list
    Write-Host ''
    $p = (Read-Host '    Taip Project ID yang mahu digunakan (lajur "Project ID")').Trim()
    if (-not $p) { Fail 'Project ID diperlukan. Cipta projek di https://console.firebase.google.com dahulu.' }
    $state.firebase_project = $p; Save-State
}
Write-NoBom (Join-Path $Root '.firebaserc') ("{`n  `"projects`": {`n    `"default`": `"$($state.firebase_project)`"`n  }`n}`n")

Info 'Deploy ke Firebase Hosting...'
Run 'firebase.cmd' @('deploy', '--only', 'hosting', '--project', $state.firebase_project)

# ---------------------------------------------------------------- 3. Domain
Say 'SIAP!' 'Green'
Info "Laman sementara : https://$($state.firebase_project).web.app"
Info "Web App (GAS)   : $gasUrl"
if ($state.sheet_url) { Info "Google Sheet    : $($state.sheet_url)" }
if ($state.script_url) { Info "Apps Script     : $($state.script_url)" }
Write-Host ''
if (-not $state.domain_done) {
    Write-Host '    Langkah terakhir (sekali sahaja): sambung booking.akmalsys.com' -ForegroundColor Yellow
    Info '    1. Halaman Firebase Hosting akan dibuka -> "Add custom domain" -> booking.akmalsys.com'
    Info '    2. Salin rekod DNS (TXT dan A) yang dipaparkan ke panel DNS akmalsys.com, nama host: booking'
    Info '    3. Tunggu status "Connected" (15 minit - 24 jam). SSL dipasang automatik.'
    Start-Process "https://console.firebase.google.com/project/$($state.firebase_project)/hosting/sites"
    $ans = Read-Host '    Sudah tambah domain di Firebase? (y = jangan tanya lagi)'
    if ($ans -match '^[yY]') { $state.domain_done = $true; Save-State }
}
Write-Host ''
Info 'Seterusnya: buka https://booking.akmalsys.com/platform (atau laman sementara di atas + /platform)'
Info 'untuk mencipta akaun Super Admin dan sekolah pertama.'
Write-Host ''
Read-Host 'Tekan Enter untuk tutup'
