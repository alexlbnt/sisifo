use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_autostart::ManagerExt;

const TRAY_ID: &str = "sisifo";

/// Ícones com o número do que falta hoje (gerados por `npm run icons`): 0 a 9 e "9+".
const ICONS: [&[u8]; 11] = [
    include_bytes!("../icons/tray-0.png"),
    include_bytes!("../icons/tray-1.png"),
    include_bytes!("../icons/tray-2.png"),
    include_bytes!("../icons/tray-3.png"),
    include_bytes!("../icons/tray-4.png"),
    include_bytes!("../icons/tray-5.png"),
    include_bytes!("../icons/tray-6.png"),
    include_bytes!("../icons/tray-7.png"),
    include_bytes!("../icons/tray-8.png"),
    include_bytes!("../icons/tray-9.png"),
    include_bytes!("../icons/tray-9plus.png"),
];

/// O item "Iniciar com o Windows", para acompanhar a mudança feita em Configurações.
pub struct AutostartItem(pub CheckMenuItem<Wry>);

pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let enabled = app.autolaunch().is_enabled().unwrap_or(false);
    let capture = MenuItem::with_id(app, "capture", "Captura rápida", true, None::<&str>)?;
    let panel = MenuItem::with_id(app, "panel", "Abrir painel", true, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Abrir Sísifo", true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(app, "autostart", "Iniciar com o Windows", true, enabled, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &capture,
            &panel,
            &open,
            &PredefinedMenuItem::separator(app)?,
            &autostart,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    app.manage(AutostartItem(autostart));

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::from_bytes(ICONS[0])?)
        .tooltip("Sísifo")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "capture" => crate::windows::toggle_capture(app),
            "panel" => crate::windows::open_panel_window(app),
            "open" => crate::windows::show_main(app),
            "autostart" => {
                let launcher = app.autolaunch();
                let on = launcher.is_enabled().unwrap_or(false);
                let _ = if on { launcher.disable() } else { launcher.enable() };
                sync_autostart_item(app);
            }
            "quit" => crate::updater::quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                crate::windows::show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

/// Deixa o ✓ do menu igual ao estado real do início automático.
pub fn sync_autostart_item(app: &AppHandle) {
    if let Some(item) = app.try_state::<AutostartItem>() {
        let _ = item.0.set_checked(app.autolaunch().is_enabled().unwrap_or(false));
    }
}

/// A janela principal informa quantos itens faltam hoje.
#[tauri::command]
pub fn set_tray_pending(app: AppHandle, count: u32) -> Result<(), String> {
    let tray = app.tray_by_id(TRAY_ID).ok_or("bandeja ainda não criada")?;
    let icon = Image::from_bytes(ICONS[count.min(10) as usize]).map_err(|e| e.to_string())?;
    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    let tip = match count {
        0 => "Sísifo".to_string(),
        1 => "Sísifo · 1 pendente hoje".to_string(),
        n => format!("Sísifo · {n} pendentes hoje"),
    };
    tray.set_tooltip(Some(tip)).map_err(|e| e.to_string())
}
