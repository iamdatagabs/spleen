"""PyInstaller entry point for the bundled SPLEEN FastAPI service."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=8765,
        log_level="warning",
        access_log=False,
    )
