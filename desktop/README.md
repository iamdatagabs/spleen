# SPLEEN Desktop for Windows

The desktop edition packages the existing browser interface and the FastAPI reference engine into a Windows application.

## Architecture

- Desktop shell: Tauri 2 (Rust).
- Frontend: existing HTML/CSS/JavaScript, staged as local application assets.
- 3D renderer: Three.js bundled locally; no CDN is required at runtime.
- Backend: FastAPI/Python, frozen as spleen-api.exe with PyInstaller.
- Local transport: loopback only (127.0.0.1:8765); no public server is required.
- Installer: NSIS (.exe) and MSI.

The browser simulation remains a local frontend capability. The Python API is packaged alongside the desktop application for reference-model endpoints and future API-backed workflows.

## Development prerequisites

- Windows 10/11 x64
- Python 3.11+
- Node.js 20+
- Rust stable with the MSVC toolchain
- Microsoft C++ Build Tools

From the repository root:

    python -m pip install -r backend/requirements.txt pytest pyinstaller
    python -m pytest backend/tests -q
    cd desktop
    npm install
    npm run dev

The frontend staging script copies only the required interface assets and model documentation into desktop/frontend. Three.js is copied from the local npm dependency into that staged directory.

## Build

The Windows workflow tests the Python backend, packages it as a sidecar executable, stages the frontend, and produces NSIS/MSI installers.

    cd desktop
    npm install
    python -m pip install -r ../backend/requirements.txt pyinstaller
    pyinstaller --clean --onefile --name spleen-api --distpath src-tauri/target/release backend_entry.py
    Copy-Item src-tauri/target/release/spleen-api.exe src-tauri/spleen-api.exe
    npm run build

## API process

The packaged process binds to 127.0.0.1:8765. It is owned by the desktop shell and terminated when the application window closes. Do not expose this local API on a network interface.

## Current implementation boundary

This is the desktop foundation, not yet a fully integrated desktop release. The frontend currently runs the existing browser simulation; the API is bundled and started for subsequent API-backed workflows. Startup readiness/health monitoring, user-selectable data directories, persistent experiment storage, code signing, installer upgrade testing, and end-to-end Windows validation remain follow-up work.

SPLEEN is an experimental research/education prototype, not clinically validated software or a clinical decision-support system.
