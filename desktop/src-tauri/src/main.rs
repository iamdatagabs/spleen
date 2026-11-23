#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, path::BaseDirectory};

struct ApiProcess(Mutex<Option<Child>>);

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;

            let mut command = if cfg!(debug_assertions) {
                let repo_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                    .join("../..")
                    .canonicalize()?;
                let mut dev = Command::new("python");
                dev.args(["-m", "backend.desktop_entry"]).current_dir(repo_root);
                dev
            } else {
                let api_path = app.path().resolve("spleen-api.exe", BaseDirectory::Resource)?;
                Command::new(api_path)
            };

            let child = command
                .env("SPLEEN_DATA_DIR", data_dir)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()?;
            app.manage(ApiProcess(Mutex::new(Some(child))));
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
