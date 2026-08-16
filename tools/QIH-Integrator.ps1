# QIH-Integrator.ps1 — thin prestart wrapper (optional)
# Runs the Python mathematical audit. Does NOT claim promotion or sentience.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $Root) { $Root = Get-Location }

Write-Host "[QIH] Running mathematical audit (simulation formulas only)..."
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $py) {
    Write-Host "[QIH] Python not found — skip audit."
    exit 0
}

& $py.Source (Join-Path $Root "qih_consciousness/audit.py")
$code = $LASTEXITCODE
if ($code -ne 0) {
    Write-Host "[QIH] Audit reported FAIL (exit $code). Prestart continues; this is not a deploy blocker."
    exit 1
}
Write-Host "[QIH] Audit metrics OK (software checks only — no Gate promotion)."
exit 0
