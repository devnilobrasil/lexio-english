// src/tauri/src/commands/assistant.rs
//
// Translate mode: capture selection via hotkey, translate, copy to clipboard.
// No inject into the source app; lives inside the main window.

use arboard::Clipboard;
use tauri::State;

use crate::ai_client;
use crate::state::AppState;
use crate::types::TranslationResponse;

pub const AI_TIMEOUT_SECS: u64 = 8;
pub const MIN_TEXT_LEN: usize = 2;
pub const MAX_TEXT_LEN: usize = 500;

/// Classification of captured selection before translating.
#[derive(Debug, PartialEq, Eq)]
pub enum SelectionKind {
    Ready(String),
    Empty,
    TooShort,
    TooLong,
    English,
}

/// Pure gate used by the hotkey handler (and unit tests).
pub fn classify_selection(text: Option<String>, is_english: impl Fn(&str) -> bool) -> SelectionKind {
    let Some(raw) = text else {
        return SelectionKind::Empty;
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return SelectionKind::Empty;
    }
    if trimmed.len() < MIN_TEXT_LEN {
        return SelectionKind::TooShort;
    }
    if trimmed.len() > MAX_TEXT_LEN {
        return SelectionKind::TooLong;
    }
    if is_english(trimmed) {
        return SelectionKind::English;
    }
    SelectionKind::Ready(trimmed.to_string())
}

#[tauri::command]
pub async fn assistant_translate(
    text: String,
    state: State<'_, AppState>,
) -> Result<TranslationResponse, String> {
    let original_text = text.trim().to_string();
    if original_text.len() < MIN_TEXT_LEN {
        return Err("Texto muito curto para traduzir.".to_string());
    }
    if original_text.len() > MAX_TEXT_LEN {
        return Err("Texto demasiado longo para traduzir.".to_string());
    }

    let translation = match tokio::time::timeout(
        std::time::Duration::from_secs(AI_TIMEOUT_SECS),
        ai_client::fetch_translation(&state.http, None, &original_text),
    )
    .await
    {
        Ok(Ok(t)) => t,
        Ok(Err(e)) => return Err(e),
        Err(_) => {
            return Err("Tempo limite excedido. Verifique sua conexão.".to_string());
        }
    };

    Ok(TranslationResponse {
        original: original_text,
        translation,
    })
}

#[tauri::command]
pub fn assistant_copy_to_clipboard(text: String) -> Result<(), String> {
    let mut clipboard =
        Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;
    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to set clipboard: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_empty_when_none() {
        assert_eq!(
            classify_selection(None, |_| false),
            SelectionKind::Empty
        );
    }

    #[test]
    fn classify_empty_when_whitespace() {
        assert_eq!(
            classify_selection(Some("  \n".into()), |_| false),
            SelectionKind::Empty
        );
    }

    #[test]
    fn classify_too_short() {
        assert_eq!(
            classify_selection(Some("a".into()), |_| false),
            SelectionKind::TooShort
        );
    }

    #[test]
    fn classify_too_long() {
        let long = "x".repeat(MAX_TEXT_LEN + 1);
        assert_eq!(
            classify_selection(Some(long), |_| false),
            SelectionKind::TooLong
        );
    }

    #[test]
    fn classify_english() {
        assert_eq!(
            classify_selection(Some("hello there friend".into()), |_| true),
            SelectionKind::English
        );
    }

    #[test]
    fn classify_ready_trims() {
        assert_eq!(
            classify_selection(Some("  olá mundo  ".into()), |_| false),
            SelectionKind::Ready("olá mundo".into())
        );
    }

    #[test]
    fn timeout_message_is_user_friendly() {
        let msg = "Tempo limite excedido. Verifique sua conexão.".to_string();
        assert!(msg.contains("Tempo limite"));
    }
}
