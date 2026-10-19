param(
    [switch]$IncludeDev,
    [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPath = Join-Path $projectRoot ".venv"
$venvPython = Join-Path $venvPath "Scripts\python.exe"

if (-not (Test-Path -LiteralPath $venvPython)) {
    $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($pyLauncher) {
        & py -3.12 -m venv $venvPath
        if ($LASTEXITCODE -ne 0) {
            & py -m venv $venvPath
        }
    } else {
        & python -m venv $venvPath
    }
}

if (-not (Test-Path -LiteralPath $venvPython)) {
    throw "Não foi possível criar o ambiente virtual. Instale Python 3.12+ e tente novamente."
}

& $venvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Falha ao atualizar o pip." }
& $venvPython -m pip install -r (Join-Path $projectRoot "backend\requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar as dependências do backend." }

if ($IncludeDev) {
    & $venvPython -m pip install -r (Join-Path $projectRoot "backend\requirements-dev.txt")
    if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar as dependências de desenvolvimento." }
}

if (-not $SkipFrontend) {
    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npmCommand) {
        throw "Node.js/npm não encontrado. Instale Node.js 20+ ou execute com -SkipFrontend."
    }
    Push-Location -LiteralPath (Join-Path $projectRoot "frontend")
    try {
        & $npmCommand.Source install
        if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar as dependências do frontend." }
        & $npmCommand.Source run build
        if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o frontend React." }
    } finally {
        Pop-Location
    }
}

Write-Host "Instalação concluída." -ForegroundColor Green
if ($SkipFrontend) {
    Write-Host "Frontend não compilado. Execute npm install e npm run build em .\frontend antes de iniciar." -ForegroundColor Yellow
} else {
    Write-Host "Execute .\run.ps1 na raiz do projeto." -ForegroundColor Cyan
}
