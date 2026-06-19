// Insight Asset OS — Tauri lib entry
//
// 这里写所有 Tauri 业务逻辑（命令、事件、插件注册等）
// main.rs 只是壳子

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub data_dir: String,
    pub config_path: String,
}

#[tauri::command]
fn get_app_info(app: tauri::AppHandle) -> AppInfo {
    let data_dir = app
        .path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let config_path = format!("{}/config.json", data_dir);
    AppInfo {
        name: "Insight Asset OS".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        data_dir,
        config_path,
    }
}

#[tauri::command]
fn open_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    Ok(data_dir.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![get_app_info, open_data_dir])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
