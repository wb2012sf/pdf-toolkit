/// Start the app.
///
/// There are no custom commands: every PDF operation runs in the webview
/// against `@pdf-toolkit/core/bytes`, the same code the CLI and the web build
/// use. Rust is here only for the window, the native save dialog, and writing
/// the bytes the page hands back.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("failed to start pdf-toolkit");
}
