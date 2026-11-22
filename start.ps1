$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (!(Test-Path -LiteralPath '.env')) { throw 'Create .env from .env.example first.' }
if (!(Test-Path -LiteralPath '.venv\Scripts\python.exe')) { throw 'Install Python dependencies into .venv first. See README.md.' }
$env:PATH = (Join-Path $PSScriptRoot '.venv\Scripts') + ';' + $env:PATH
npm run dev
