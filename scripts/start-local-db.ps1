$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$localDir = Join-Path $projectRoot '.local'
$pgCtl = Join-Path $localDir 'pgsql/bin/pg_ctl.exe'
$dataDir = Join-Path $localDir 'pgdata'
$logPath = Join-Path $localDir 'postgres.log'

# Other developers can continue using Docker or their own PostgreSQL installation.
if (!(Test-Path -LiteralPath $pgCtl) -or !(Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) {
    exit 0
}

& $pgCtl -D $dataDir status *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Starting local PostgreSQL...'
    $database = Start-Process -FilePath $pgCtl -ArgumentList @('-D', ('"{0}"' -f $dataDir), '-l', ('"{0}"' -f $logPath), '-w', 'start') -WindowStyle Hidden -PassThru
    $database.WaitForExit()
    if ($database.ExitCode -ne 0) {
        throw "PostgreSQL could not start. Check $logPath"
    }
}
