// Without this a release build on Windows also opens a console window behind
// the app. Debug builds keep it, so panics and logs stay visible.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pdf_toolkit_lib::run()
}
