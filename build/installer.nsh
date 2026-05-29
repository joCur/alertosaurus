!macro customInstall
  ; Add app resources directory to user PATH so 'roar' CLI is available via node
  nsExec::ExecToLog 'setx PATH "%PATH%;$INSTDIR\resources\app\dist\cli"'
!macroend

!macro customUnInstall
  ; Clean up PATH entry on uninstall
  nsExec::ExecToLog 'powershell -Command "[Environment]::SetEnvironmentVariable(\"PATH\", ($env:PATH -replace [regex]::Escape(\"$INSTDIR\resources\app\dist\cli;\"), \"\"), \"User\")"'
!macroend
