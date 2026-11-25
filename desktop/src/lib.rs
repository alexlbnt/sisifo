mod settings;
mod tray;
mod updater;
mod windows;

/// O site publicado: todas as janelas carregam páginas dele.
pub const APP_URL: &str = "https://sisifo-two.vercel.app";

/// No desenvolvimento, o Vite local; no executável, o site publicado.
pub fn app_url() -> &'static str {
    if cfg!(debug_assertions) {
        "http://localhost:5173"
    } else {
        APP_URL
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Abrir o executável de novo só mostra a janela que já existe.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            windows::show_main(app)
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .invoke_handler(tauri::generate_handler![
            windows::app_ready,
            windows::hide_capture,
            windows::open_panel,
            windows::open_app,
            tray::set_tray_pending,
            settings::get_desktop_settings,
            settings::set_desktop_settings,
        ])
        .setup(|app| {
            let handle = app.handle();
            // Iniciado com o Windows: fica escondido na bandeja.
            let hidden = std::env::args().any(|a| a == "--hidden");
            windows::create_main(handle, !hidden)?;
            windows::create_capture(handle)?;
            settings::first_run(handle);
            tray::build_tray(handle)?;
            settings::register_saved_shortcut(handle);
            updater::spawn_check(handle, hidden);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Fechar a janela principal só a esconde; "Sair" fica na bandeja.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Sísifo");
}
