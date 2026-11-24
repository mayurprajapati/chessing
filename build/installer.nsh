; Chromium starts its GPU process in an app container sandbox, which can only
; start an executable that "ALL APPLICATION PACKAGES" may read. Program Files
; grants that by default, but a per-user install under %LOCALAPPDATA%\Programs
; may not, and then Chessing exits at startup ("GPU process isn't usable").
; Grant read/execute on the install folder, as Chrome's installer does.
!macro customInstall
  nsExec::ExecToLog 'icacls "$INSTDIR" /grant *S-1-15-2-1:(OI)(CI)(RX) /T /C /Q'
  Pop $0
!macroend
