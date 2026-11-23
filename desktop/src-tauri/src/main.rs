#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, path::BaseDirectory};

struct ApiProcess(Mutex<Option<Child>>);

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if !cfg!(debug_assertions) {
                let api_path = app
                    .path()
                    .resolve("spleen-api.exe", BaseDirectory::Resource)?;
                let child = Command::new(api_path)
                    .args(["--host", "127.0.0.1", "--port", "8765"])
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()?;
                app.manage(ApiProcess(Mutex::new(Some(child))));
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(process) = window.app_handle().try_state::<ApiProcess>() {
                    if let Ok(mut child) = process.0.lock() {
                        if let Some(child) = child.as_mut() {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run SPLEEN desktop application");
}
