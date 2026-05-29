!macro customInstall
  ; Add app directory to user PATH so 'roar' CLI is available
  nsExec::ExecToLog 'setx PATH "%PATH%;$INSTDIR\resources\app"'
!macroend

!macro customUnInstall
  ; Clean up PATH entry on uninstall
  nsExec::ExecToLog 'powershell -Command "[Environment]::SetEnvironmentVariable(\"PATH\", ($env:PATH -replace [regex]::Escape(\"$INSTDIR\resources\app;\"), \"\"), \"User\")"'
!macroend
