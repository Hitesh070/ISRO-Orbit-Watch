$wsh = New-Object -ComObject WScript.Shell
$desktopPaths = @(
    [Environment]::GetFolderPath("Desktop"),
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\OneDrive\Desktop"
) | Select-Object -Unique

$exePath = "C:\Users\hites\OneDrive\Documents\Projects\Orbit Guard\dist-desktop\win-unpacked\OrbitGuard.exe"
$iconPath = "C:\Users\hites\OneDrive\Documents\Projects\Orbit Guard\resources\icons\icon.ico"
$workingDir = "C:\Users\hites\OneDrive\Documents\Projects\Orbit Guard\dist-desktop\win-unpacked"

foreach ($dp in $desktopPaths) {
    if (Test-Path $dp) {
        $shortcutPath = Join-Path $dp "OrbitGuard.lnk"
        $shortcut = $wsh.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $exePath
        $shortcut.WorkingDirectory = $workingDir
        $shortcut.Description = "OrbitGuard | Real-Time Space Situational Awareness & Ground Station"
        if (Test-Path $iconPath) {
            $shortcut.IconLocation = "$iconPath,0"
        }
        $shortcut.Save()
        Write-Host "Refreshed desktop shortcut at: $shortcutPath"
    }
}
