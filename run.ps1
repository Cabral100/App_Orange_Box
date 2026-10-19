param(
    [int]$Port = 8000,
    [string]$HostAddress = "127.0.0.1",
    [string]$ModelPath = "",
    [string]$ExpectedModelSha256 = "",
    [switch]$SkipBuild,
    [switch]$SkipChecksum,
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"
$defaultModel = Join-Path $projectRoot "backend\models\best.pt"
$frontendRoot = Join-Path $projectRoot "frontend"
$frontendBuild = Join-Path $frontendRoot "dist\index.html"

if (-not (Test-Path -LiteralPath $venvPython)) {
    throw "Ambiente virtual não encontrado. Execute .\scripts\setup.ps1 primeiro."
}

$configuredModel = if ($ModelPath) {
    $ModelPath
} elseif ($env:CITROSCAN_MODEL_PATH) {
    $env:CITROSCAN_MODEL_PATH
} else {
    $defaultModel
}

if ([IO.Path]::IsPathRooted($configuredModel)) {
    $resolvedModel = [IO.Path]::GetFullPath($configuredModel)
} else {
    $projectCandidate = [IO.Path]::GetFullPath((Join-Path $projectRoot $configuredModel))
    $backendCandidate = [IO.Path]::GetFullPath((Join-Path (Join-Path $projectRoot "backend") $configuredModel))
    $resolvedModel = if (Test-Path -LiteralPath $projectCandidate) { $projectCandidate } else { $backendCandidate }
}

if (-not (Test-Path -LiteralPath $resolvedModel)) {
    throw "Modelo não encontrado em $resolvedModel. Consulte o README."
}

$latestSource = Get-ChildItem -LiteralPath (Join-Path $frontendRoot "src"), (Join-Path $frontendRoot "public") -Recurse -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
$buildIsMissing = -not (Test-Path -LiteralPath $frontendBuild)
$buildIsStale = -not $buildIsMissing -and $latestSource.LastWriteTimeUtc -gt (Get-Item -LiteralPath $frontendBuild).LastWriteTimeUtc

if (($buildIsMissing -or $buildIsStale) -and -not $SkipBuild) {
    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npmCommand) {
        throw "O frontend precisa ser compilado e o npm não foi encontrado. Instale Node.js 20+."
    }
    Push-Location -LiteralPath $frontendRoot
    try {
        & $npmCommand.Source run build
        if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o frontend." }
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path -LiteralPath $frontendBuild)) {
    throw "Build React não encontrado. Execute npm run build em frontend."
}

$defaultHash = "84FB5A7EDE6CDF6F351866E5FE5C113DEDFB68787AA29012BD84C4EEAAD4AE6A"
$configuredHash = if ($ExpectedModelSha256) {
    $ExpectedModelSha256
} elseif ($null -ne $env:CITROSCAN_MODEL_SHA256) {
    $env:CITROSCAN_MODEL_SHA256
} elseif ([IO.Path]::GetFullPath($resolvedModel) -eq [IO.Path]::GetFullPath($defaultModel)) {
    $defaultHash
} else {
    ""
}

if (-not $SkipChecksum -and $configuredHash) {
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedModel).Hash
    if ($actualHash -ne $configuredHash.ToUpperInvariant()) {
        throw "O SHA-256 do modelo não corresponde ao checkpoint configurado."
    }
}

Set-Location -LiteralPath $projectRoot
$env:YOLO_CONFIG_DIR = Join-Path $projectRoot ".ultralytics"
$env:PYTHONUTF8 = "1"
$env:CITROSCAN_MODEL_PATH = $resolvedModel
$env:CITROSCAN_MODEL_SHA256 = if ($SkipChecksum) { "" } else { $configuredHash }
$env:CITROSCAN_VERIFY_MODEL_SHA256 = if ($SkipChecksum) { "false" } else { "true" }
if ($CheckOnly) {
    Write-Host "Configuração do CYF validada." -ForegroundColor Green
    return
}
Write-Host "CYF disponível em http://${HostAddress}:$Port" -ForegroundColor Green
Write-Host "Pressione Ctrl+C para encerrar." -ForegroundColor DarkGray
& $venvPython -m uvicorn backend.app.main:app --host $HostAddress --port $Port --workers 1
