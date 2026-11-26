param (
    [Parameter(Mandatory = $false, Position = 0)] [string]$Issue,
    [Parameter(Mandatory = $false)] [string]$PlanPath = "",
    [Parameter(Mandatory = $false)] [string]$Context = "",
    [Parameter(Mandatory = $false)] [string]$Files = ""
)

$scriptPath = Join-Path $PSScriptRoot "review.mjs"
$argsArray = @()
if ($Issue) {
    $argsArray += "--issue"
    $argsArray += $Issue
}
if ($PlanPath) {
    $argsArray += "--plan"
    $argsArray += $PlanPath
}
if ($Context) {
    $argsArray += "--context"
    $argsArray += $Context
}
if ($Files) {
    $argsArray += "--files"
    $argsArray += $Files
}
$argsArray += "--root"
$argsArray += (Get-Location).Path

node $scriptPath @argsArray
exit $LASTEXITCODE