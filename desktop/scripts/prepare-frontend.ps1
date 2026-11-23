$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$desktopRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frontend = Join-Path $desktopRoot "frontend"
$vendor = Join-Path $frontend "vendor"

if (Test-Path $frontend) { Remove-Item $frontend -Recurse -Force }
New-Item -ItemType Directory -Path $frontend -Force | Out-Null
New-Item -ItemType Directory -Path $vendor -Force | Out-Null

$assets = @("index.html", "styles.css", "app.js", "analysis.js", "physiology.js", "spleen3d.mjs", "spatial-model.mjs")
foreach ($asset in $assets) {
    Copy-Item (Join-Path $repoRoot $asset) (Join-Path $frontend $asset)
}
$docs = Join-Path $frontend "docs"
New-Item -ItemType Directory -Path $docs -Force | Out-Null
Copy-Item (Join-Path $repoRoot "docs/model.md") (Join-Path $docs "model.md")
Copy-Item (Join-Path $repoRoot "docs/model.tex") (Join-Path $docs "model.tex")
$three = Join-Path $desktopRoot "node_modules/three/build/three.module.js"
if (-not (Test-Path $three)) { throw "Three.js dependency not found. Run npm install first." }
Copy-Item $three (Join-Path $vendor "three.module.js")
Write-Host "SPLEEN frontend staged in $frontend"
