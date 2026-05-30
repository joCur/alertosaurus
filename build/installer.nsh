!macro customInstall
  CopyFiles "$INSTDIR\resources\app.asar.unpacked\dist\cli\roar.exe" "$INSTDIR\roar.exe"

  ; Add install directory to user PATH so 'roar' works from any terminal
  FileOpen $0 "$PLUGINSDIR\add-path.ps1" w
  FileWrite $0 "$$dir = '$INSTDIR'$\r$\n"
  FileWrite $0 "$$p = [Environment]::GetEnvironmentVariable('Path', 'User')$\r$\n"
  FileWrite $0 "if (-not $$p) { $$p = '' }$\r$\n"
  FileWrite $0 "$$parts = $$p -split ';' | Where-Object { $$_ -ne '' }$\r$\n"
  FileWrite $0 "if ($$dir -notin $$parts) {$\r$\n"
  FileWrite $0 "  $$parts += $$dir$\r$\n"
  FileWrite $0 "  [Environment]::SetEnvironmentVariable('Path', ($$parts -join ';'), 'User')$\r$\n"
  FileWrite $0 "}$\r$\n"
  FileClose $0
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\add-path.ps1"'
  Pop $0

  ; HWND_BROADCAST=0xFFFF, WM_SETTINGCHANGE=0x001A
  SendMessage 0xFFFF 0x001A 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro customUnInstall
  Delete "$INSTDIR\roar.exe"

  ; Remove install directory from user PATH
  FileOpen $0 "$PLUGINSDIR\remove-path.ps1" w
  FileWrite $0 "$$dir = '$INSTDIR'$\r$\n"
  FileWrite $0 "$$p = [Environment]::GetEnvironmentVariable('Path', 'User')$\r$\n"
  FileWrite $0 "if ($$p) {$\r$\n"
  FileWrite $0 "  $$parts = $$p -split ';' | Where-Object { $$_ -ne '' -and $$_ -ne $$dir }$\r$\n"
  FileWrite $0 "  [Environment]::SetEnvironmentVariable('Path', ($$parts -join ';'), 'User')$\r$\n"
  FileWrite $0 "}$\r$\n"
  FileClose $0
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\remove-path.ps1"'
  Pop $0

  SendMessage 0xFFFF 0x001A 0 "STR:Environment" /TIMEOUT=5000
!macroend
