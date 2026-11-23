# SPLEEN Desktop for Windows

The desktop edition packages the existing browser interface and the FastAPI reference engine into a Windows application.

## Architecture

- **Desktop shell:** Tauri 2 (Rust).
- **Frontend:** the existing repository interface, bundled as local assets.
- **Backend:** FastAPI/Python, frozen as `spleen-api.exe` with PyInstaller.
- **Local transport:** loopback only (`127.0.0.1:8765`); no public server is required.
- **Installer:** NSIS (`.exe`) and MSI.

The browser simulation remains available as a local frontend capability. The Python API is packaged alongside the desktop application for reference-model endpoints and future frontend integration.

## Development prerequisites

- Windows 10/11 x64
- Python 3.11+
- Node.js 20+
- Rust stable with the MSVC toolchain
- Microsoft C++ Build Tools

From the repository root:

```powershell
python -m pip install -r backend/requirements.txt pyinstaller
pyinstaller --onefile --name spleen-api --distpath desktop/src-tauri/target/release desktop/backend_entry.py
cd desktop
npm install
npm run dev
```

The development shell currently loads the repository frontend. The packaged API process is launched only in release builds.

## Build

The Windows GitHub Actions workflow builds the backend executable, stages it as a Tauri resource, and produces NSIS/MSI installers:

```powershell
cd desktop
npm install
npm run build
```

## API process

The packaged process binds to `127.0.0.1:8765`. It is owned by the desktop shell and terminated when the application window closes. Do not expose this development API on a network interface.

## Current implementation boundary

This is the desktop foundation, not yet a fully integrated desktop release. The frontend currently runs the existing browser simulation; the API is bundled and started for subsequent API-backed workflows. Health checks, startup readiness, user-selectable data directories, persistent experiment storage, signing, and installer upgrade testing remain follow-up work.

SPLEEN is an experimental research/education prototype, not clinically validated software or a clinical decision-support system.
