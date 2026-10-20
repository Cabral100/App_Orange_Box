$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $projectRoot "mobile"
$modelPath = Join-Path $mobileRoot "assets\models\best.onnx"
$expectedHash = "5DAA66FEE49524C5F0F0ED1D8945EA1BE858347970A508EEC73C85DE5DD7A962"

if (-not (Test-Path -LiteralPath $modelPath)) {
    throw "Modelo offline ausente: $modelPath"
}

$actualHash = (Get-FileHash -LiteralPath $modelPath -Algorithm SHA256).Hash
if ($actualHash -ne $expectedHash) {
    throw "O hash do modelo offline mudou. Esperado: $expectedHash. Atual: $actualHash"
}

if (-not (Test-Path -LiteralPath (Join-Path $mobileRoot "node_modules"))) {
    throw "Dependencias ausentes. Execute npm install dentro de mobile."
}

Push-Location $mobileRoot
try {
    npm run typecheck
    if ($LASTEXITCODE -ne 0) {
        throw "A checagem TypeScript falhou."
    }
}
finally {
    Pop-Location
}

Write-Host "CYF Mobile validado: modelo offline presente e TypeScript sem erros." -ForegroundColor Green
