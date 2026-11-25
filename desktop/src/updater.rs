use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

/// Versão nova já baixada, esperando a hora de instalar.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<(Update, Vec<u8>)>>);

/// 30 s depois de abrir, procura versão nova nas Releases e baixa em segundo plano.
/// No Windows, instalar fecha o app: por isso só instala quando ninguém está usando
/// (aberto com o Windows, escondido) ou ao "Sair" pela bandeja.
pub fn spawn_check(app: &AppHandle, started_hidden: bool) {
    app.manage(PendingUpdate::default());
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio_sleep(Duration::from_secs(30)).await;
        if let Err(e) = check(&app, started_hidden).await {
            eprintln!("atualização: {e}");
        }
    });
}

async fn tokio_sleep(d: Duration) {
    // Sem depender do tokio diretamente: espera numa thread do pool bloqueante.
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(d)).await;
}

async fn check(app: &AppHandle, started_hidden: bool) -> Result<(), Box<dyn std::error::Error>> {
    let Some(update) = app.updater()?.check().await? else { return Ok(()) };
    let bytes = update.download(|_, _| {}, || {}).await?;
    if started_hidden {
        update.install(bytes)?;
    } else if let Some(pending) = app.try_state::<PendingUpdate>() {
        *pending.0.lock().unwrap() = Some((update, bytes));
    }
    Ok(())
}

/// "Sair" na bandeja: instala a versão baixada (o instalador fecha e reabre o app) ou só sai.
pub fn quit(app: &AppHandle) {
    let pending = app.try_state::<PendingUpdate>().and_then(|p| p.0.lock().unwrap().take());
    if let Some((update, bytes)) = pending {
        if update.install(bytes).is_ok() {
            return;
        }
    }
    app.exit(0);
}
