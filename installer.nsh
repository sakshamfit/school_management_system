; ─────────────────────────────────────────────────────────────────────────────
; NSIS include for School Management System
;
; UPDATE / UNINSTALL DATA-SAFETY CONTRACT
;
; Customer data lives at:  %LOCALAPPDATA%\SchoolManagementSystem
;
; The installer and updater MUST NEVER delete that directory — not during
; updates, not during uninstall (the customer may reinstall and expect their
; school data back). electron-builder's default NSIS script does not touch
; per-user AppData; these macros make the guarantee explicit and defend
; against any future template change introducing such deletion.
; ─────────────────────────────────────────────────────────────────────────────

!macro customInit
  ; Runs at installer start (including updates). Nothing to do — the
  ; updater performs its own pre-update safety backup in-app before
  ; replacing binaries.
!macroend

!macro customInstall
  ; Runs after files are installed. Deliberately empty: never create tasks
  ; that manipulate %LOCALAPPDATA%\SchoolManagementSystem.
!macroend

!macro customUnInstall
  ; Runs at the end of uninstall. We intentionally DO NOT remove the user
  ; data directory. Customer data persists by design:
  ;   - uninstalling is not a data-deletion action
  ;   - reinstall/repair must find the school's database intact
  ;
  ; If an administrator consciously wants a full purge, that is a manual,
  ; documented operator action — never something an installer does
  ; silently.
  DetailPrint "User data preserved at $LOCALAPPDATA\SchoolManagementSystem"
!macroend
