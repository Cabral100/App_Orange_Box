param(
    [int]$Port = 8000,
    [string]$AllowedEmail = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$runScript = Join-Path $projectRoot "run.ps1"
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue

if (-not $cloudflared) {
    throw "cloudflared não encontrado. Instale com: winget install Cloudflare.cloudflared"
}
if (-not (Test-Path -LiteralPath $venvPython)) {
    throw "Ambiente virtual não encontrado. Execute .\scripts\setup.ps1 primeiro."
}

& $runScript -Port $Port -HostAddress "127.0.0.1" -CheckOnly

$serverOptions = @{
    FilePath = $venvPython
    ArgumentList = @("-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", $Port, "--workers", "1")
    WorkingDirectory = $projectRoot
    WindowStyle = "Hidden"
    PassThru = $true
}
$server = Start-Process @serverOptions

try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($server.HasExited) { throw "O servidor CYF encerrou antes de iniciar." }
        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2
            if ($response.status -eq "ok") { $ready = $true; break }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $ready) { throw "O servidor CYF não respondeu em 60 segundos." }

    Write-Host "Servidor local pronto. O endereço HTTPS aparecerá abaixo." -ForegroundColor Green
    Write-Host "Abra esse endereço no celular e mantenha esta janela aberta." -ForegroundColor Cyan
    Write-Host "Pressione Ctrl+C para encerrar o túnel e o servidor." -ForegroundColor DarkGray
    $tunnelArguments = @("tunnel", "--url", "http://127.0.0.1:$Port", "--no-autoupdate")
    if ($AllowedEmail) {
        $tunnelArguments += @("--allowed-mail", $AllowedEmail)
    } else {
        Write-Host "Aviso: qualquer pessoa com a URL temporária poderá acessar o protótipo." -ForegroundColor Yellow
    }
    & $cloudflared.Source @tunnelArguments
} finally {
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
    }
}
