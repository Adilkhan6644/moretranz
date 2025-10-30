; Custom NSIS script for MoreTranz Printer installer
; This script ensures the app is stopped before uninstallation

!macro customUnInstall
  ; Kill the MoreTranz Printer process if it's running
  nsExec::Exec 'taskkill /F /IM "MoreTranz Printer.exe"'
  
  ; Wait a moment for process to fully terminate
  Sleep 1000
  
  ; Also kill any electron processes related to MoreTranz
  nsExec::Exec 'wmic process where "CommandLine like '%MoreTranz%'" delete'
  
  ; Wait again
  Sleep 500
  
  ; Remove AppData config folder
  RMDir /r "$APPDATA\moretranz-printer-app"
!macroend

!macro customInstall
  ; Nothing special needed on install
!macroend

