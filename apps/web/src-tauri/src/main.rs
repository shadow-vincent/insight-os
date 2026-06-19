// Insight Asset OS — Tauri main entry
//
// 启动流程：
// 1. 启动 Tauri WebView 窗口
// 2. WebView 加载 http://localhost:4191（devUrl）/ 或 standalone build 后的 static dist
// 3. 监听窗口关闭，关闭后台 Next.js server（如有）

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    insight_asset_os_lib::run()
}
