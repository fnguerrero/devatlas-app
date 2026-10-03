# Levanta backend (.NET) y frontend (Vite) de DevAtlas en ventanas separadas
# y abre el navegador. Uso: click derecho > Ejecutar con PowerShell, o el .cmd.
$root = $PSScriptRoot

Start-Process powershell -ArgumentList @(
  '-NoExit', '-Command',
  "Set-Location '$root\backend\DevAtlas.Api'; dotnet run --urls http://localhost:5142"
)

Start-Process powershell -ArgumentList @(
  '-NoExit', '-Command',
  "Set-Location '$root\frontend'; if (-not (Test-Path node_modules)) { npm install }; npm run dev"
)

# Espera a que el frontend responda antes de abrir el navegador (máx ~30s)
for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 1 | Out-Null
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}

Start-Process 'http://localhost:5173'
