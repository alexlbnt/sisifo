fn main() {
    // Comandos próprios do app: com o manifesto, cada um precisa de permissão
    // explícita numa capability (ver capabilities/), inclusive para o site remoto.
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&[
                "app_ready",
                "set_tray_pending",
                "hide_capture",
                "get_desktop_settings",
                "set_desktop_settings",
                "open_panel",
                "open_app",
            ])),
    )
    .expect("falha no tauri-build");
}
