; Custom NSIS script for MoreTranz Printer installer
; This script ensures the app is stopped before uninstallation

!macro customUnInstall
  ; Kill all MoreTranz Printer processes (including child processes)
  ; Try multiple times to ensure all processes are terminated
  nsExec::Exec 'taskkill /F /IM "MoreTranz Printer.exe" /T'
  Sleep 1000
  nsExec::Exec 'taskkill /F /IM "MoreTranz Printer.exe" /T'
  Sleep 500
  
  ; Kill all SumatraPDF processes (used by pdf-to-printer)
  ; Try multiple times with different methods
  nsExec::Exec 'taskkill /F /IM "SumatraPDF-3.4.6-32.exe" /T'
  Sleep 500
  nsExec::Exec 'taskkill /F /IM "SumatraPDF-3.4.6-32.exe" /T'
  Sleep 500
  
  ; Use PowerShell to kill processes more aggressively
  nsExec::Exec 'powershell -ExecutionPolicy Bypass -Command "Get-Process | Where-Object {$_.Name -like ''*Sumatra*'' -or $_.Path -like ''*MoreTranz*''} | Stop-Process -Force"'
  Sleep 1000
  
  ; Kill processes by executable path using PowerShell
  nsExec::Exec 'powershell -ExecutionPolicy Bypass -Command "$procs = Get-Process | Where-Object {$_.Path -like ''*MoreTranz Printer*'' -or $_.Path -like ''*SumatraPDF*''}; if ($procs) { $procs | Stop-Process -Force }"'
  Sleep 1000
  
  ; Final check and kill using taskkill with /FI filter
  nsExec::Exec 'taskkill /F /FI "IMAGENAME eq SumatraPDF-3.4.6-32.exe" /T'
  Sleep 500
  nsExec::Exec 'taskkill /F /FI "IMAGENAME eq MoreTranz Printer.exe" /T'
  Sleep 500
  
  ; Wait for all processes to fully terminate
  Sleep 2000
  
  ; Remove AppData config folder
  RMDir /r "$APPDATA\moretranz-printer-app"
  
  ; Remove cache folder (if still exists)
  RMDir /r "$APPDATA\moretranz-printer-app\cache"
!macroend

!macro customInstall
  ; Nothing special needed on install
!macroend

