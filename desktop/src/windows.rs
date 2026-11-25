use tauri::utils::config::BackgroundThrottlingPolicy;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_store::StoreExt;

/// Arquivo de preferências do executável (plugin-store), na pasta de dados do app.
pub const STORE: &str = "desktop.json";

/// O app já abriu uma vez neste PC: o service worker guarda o site para abrir sem internet.
fn loaded_once(app: &AppHandle) -> bool {
    app.store(STORE)
        .ok()
        .and_then(|s| s.get("loadedOnce"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

/// Janela principal: dona dos dados (stores e sincronização). Nunca é congelada
/// quando escondida, porque sincroniza e cuida dos lembretes.
pub fn create_main(app: &AppHandle, visible: bool) -> tauri::Result<()> {
    // Na primeira vez, a página local confere a conexão antes (sem internet e sem
    // cache, o WebView mostraria só uma tela de erro sem volta).
    let url = if loaded_once(app) {
        WebviewUrl::External(format!("{}/", crate::app_url()).parse().expect("URL do app"))
    } else {
        WebviewUrl::App("index.html".into())
    };
    WebviewWindowBuilder::new(app, "main", url)
        .title("Sísifo")
        .inner_size(1200.0, 800.0)
        .min_inner_size(400.0, 500.0)
        .visible(visible)
        .background_throttling(BackgroundThrottlingPolicy::Disabled)
        .build()?;
    Ok(())
}

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Chamado pelo app quando monta dentro do executável: daqui em diante, abre direto no site.
#[tauri::command]
pub fn app_ready(app: AppHandle) {
    if let Ok(store) = app.store(STORE) {
        if store.get("loadedOnce").and_then(|v| v.as_bool()) != Some(true) {
            store.set("loadedOnce", true);
            let _ = store.save();
        }
    }
}

/* ───────── Barra de captura ───────── */

const CAPTURE_W: f64 = 660.0;
const CAPTURE_H: f64 = 220.0;

/// Janela leve (desktop.html): sem stores, fala com a principal pela ponte.
pub fn create_capture(app: &AppHandle) -> tauri::Result<()> {
    let url = format!("{}/desktop.html#/captura", crate::app_url());
    WebviewWindowBuilder::new(app, "capture", WebviewUrl::External(url.parse().expect("URL da captura")))
        .title("Captura rápida")
        .inner_size(CAPTURE_W, CAPTURE_H)
        .visible(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .build()?;
    Ok(())
}

/// Atalho global e item da bandeja: mostra a barra no monitor do mouse, ou a esconde.
pub fn toggle_capture(app: &AppHandle) {
    let Some(w) = app.get_webview_window("capture") else { return };
    if w.is_visible().unwrap_or(false) {
        let _ = w.hide();
        return;
    }
    // Centralizada na horizontal, a 30% da altura do monitor onde está o mouse.
    let monitor = app
        .cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| w.primary_monitor().ok().flatten());
    if let (Some(m), Ok(size)) = (monitor, w.outer_size()) {
        let (pos, area) = (m.position(), m.size());
        let x = pos.x + (area.width as i32 - size.width as i32) / 2;
        let y = pos.y + (area.height as f64 * 0.3) as i32;
        let _ = w.set_position(tauri::PhysicalPosition::new(x, y));
    }
    let _ = w.show();
    let _ = w.set_focus();
}

#[tauri::command]
pub fn hide_capture(app: AppHandle) {
    if let Some(w) = app.get_webview_window("capture") {
        let _ = w.hide();
    }
}

/* ───────── App ⇄ painel na janela principal ───────── */

/// A janela principal troca de página: nunca há duas cópias dos dados abertas.
fn navigate_main(app: &AppHandle, path: &str) {
    if let Some(w) = app.get_webview_window("main") {
        if let Ok(url) = format!("{}{}", crate::app_url(), path).parse() {
            let _ = w.navigate(url);
        }
    }
    show_main(app);
}

pub fn open_panel_window(app: &AppHandle) {
    navigate_main(app, "/painel.html");
}

#[tauri::command]
pub fn open_panel(app: AppHandle) {
    open_panel_window(&app);
}

#[tauri::command]
pub fn open_app(app: AppHandle) {
    navigate_main(&app, "/");
}
