use std::str::FromStr;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;

use crate::windows::STORE;

/// Fora das teclas do AltGr no ABNT2 (ver src/features/desktop/shortcuts.ts).
const DEFAULT_SHORTCUT: &str = "Ctrl+Alt+Space";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    capture_shortcut: String,
    autostart: bool,
    /// O atalho salvo está de fato registrado (outro programa pode tê-lo tomado).
    #[serde(default)]
    shortcut_active: bool,
}

/// Se o atalho da captura está registrado agora.
#[derive(Default)]
pub struct ShortcutActive(AtomicBool);

fn set_active(app: &AppHandle, active: bool) {
    if let Some(state) = app.try_state::<ShortcutActive>() {
        state.0.store(active, Ordering::Relaxed);
    }
}

fn is_active(app: &AppHandle) -> bool {
    app.try_state::<ShortcutActive>().is_some_and(|s| s.0.load(Ordering::Relaxed))
}

fn saved_shortcut(app: &AppHandle) -> String {
    app.store(STORE)
        .ok()
        .and_then(|s| s.get("captureShortcut"))
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| DEFAULT_SHORTCUT.to_string())
}

fn register(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    let parsed = Shortcut::from_str(shortcut).map_err(|e| e.to_string())?;
    app.global_shortcut()
        .on_shortcut(parsed, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                crate::windows::toggle_capture(app);
            }
        })
        .map_err(|e| e.to_string())
}

/// Na abertura: o atalho salvo (ou o padrão). Se outro programa já o usa, o app segue sem ele.
pub fn register_saved_shortcut(app: &AppHandle) {
    app.manage(ShortcutActive::default());
    let ok = register(app, &saved_shortcut(app)).is_ok();
    set_active(app, ok);
}

/// Primeira vez neste PC: liga o início com o Windows (padrão do design).
pub fn first_run(app: &AppHandle) {
    let Ok(store) = app.store(STORE) else { return };
    if store.get("firstRunDone").and_then(|v| v.as_bool()) == Some(true) {
        return;
    }
    let _ = app.autolaunch().enable();
    store.set("firstRunDone", true);
    let _ = store.save();
}

#[tauri::command]
pub fn get_desktop_settings(app: AppHandle) -> DesktopSettings {
    DesktopSettings {
        capture_shortcut: saved_shortcut(&app),
        autostart: app.autolaunch().is_enabled().unwrap_or(false),
        shortcut_active: is_active(&app),
    }
}

/// Troca o atalho (voltando ao anterior se o novo estiver ocupado) e o início com o Windows.
#[tauri::command]
pub fn set_desktop_settings(app: AppHandle, settings: DesktopSettings) -> Value {
    let current = saved_shortcut(&app);
    // Mesmo atalho, mas não registrado (outro programa o tinha ao abrir): tenta de novo.
    if settings.capture_shortcut == current && !is_active(&app) {
        if register(&app, &current).is_err() {
            return json!({ "ok": false, "error": "shortcut-in-use" });
        }
        set_active(&app, true);
    }
    if settings.capture_shortcut != current {
        if Shortcut::from_str(&settings.capture_shortcut).is_err() {
            return json!({ "ok": false, "error": "invalid" });
        }
        if let Ok(old) = Shortcut::from_str(&current) {
            let _ = app.global_shortcut().unregister(old);
        }
        if register(&app, &settings.capture_shortcut).is_err() {
            let restored = register(&app, &current).is_ok();
            set_active(&app, restored);
            return json!({ "ok": false, "error": "shortcut-in-use" });
        }
        set_active(&app, true);
        if let Ok(store) = app.store(STORE) {
            store.set("captureShortcut", settings.capture_shortcut.clone());
            let _ = store.save();
        }
    }

    let launcher = app.autolaunch();
    let _ = if settings.autostart { launcher.enable() } else { launcher.disable() };
    crate::tray::sync_autostart_item(&app);
    json!({ "ok": true })
}
