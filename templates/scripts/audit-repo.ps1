param (
    [Parameter(Mandatory = $false)] [string]$Scope = "",
    [Parameter(Mandatory = $false)] [int]$MaxFiles = 0,
    [Parameter(Mandatory = $false)] [int]$MaxLinesPerFile = 0
)

$scriptPath = Join-Path $PSScriptRoot "audit-repo.mjs"
$argsArray = @()
if ($Scope) {
    $argsArray += "--scope"
    $argsArray += $Scope
}
if ($MaxFiles -gt 0) {
    $argsArray += "--max-files"
    $argsArray += $MaxFiles
}
if ($MaxLinesPerFile -gt 0) {
    $argsArray += "--max-lines-per-file"
    $argsArray += $MaxLinesPerFile
}
$argsArray += "--root"
$argsArray += (Get-Location).Path

node $scriptPath @argsArray
exit $LASTEXITCODE