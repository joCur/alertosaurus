!macro customInstall
  ; Create roar.cmd wrapper in app directory
  FileOpen $0 "$INSTDIR\roar.cmd" w
  FileWrite $0 '@echo off$\r$\n'
  FileWrite $0 '"$INSTDIR\resources\app\dist\cli\index.js" %*$\r$\n'
  FileClose $0

  ; Add app directory to user PATH
  nsExec::ExecToLog 'setx PATH "$INSTDIR;%PATH%"'
!macroend

!macro customUnInstall
  Delete "$INSTDIR\roar.cmd"
!macroend
