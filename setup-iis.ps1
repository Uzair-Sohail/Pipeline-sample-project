

$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script from an Administrator PowerShell.'
}

$features = @(
    'IIS-WebServerRole',
    'IIS-WebServer',
    'IIS-CommonHttpFeatures',
    'IIS-StaticContent',
    'IIS-DefaultDocument',
    'IIS-HttpErrors',
    'IIS-HttpCompressionStatic',
    'IIS-ManagementConsole'
)

Enable-WindowsOptionalFeature -Online -FeatureName $features -All -NoRestart | Out-Null
Start-Service W3SVC
Set-Service W3SVC -StartupType Automatic

Get-Service W3SVC | Format-Table Name, Status, StartType -AutoSize
Write-Host 'IIS is ready. Run the Jenkins pipeline to create the CalculatorApp site on port 8090.'
