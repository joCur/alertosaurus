!macro customInstall
  FileOpen $0 "$INSTDIR\roar.cmd" w
  FileWrite $0 '@echo off$\r$\n'
  FileWrite $0 'node "$INSTDIR\resources\app\dist\cli\index.js" %*$\r$\n'
  FileClose $0
!macroend

!macro customUnInstall
  Delete "$INSTDIR\roar.cmd"
!macroend
