// src/tauri/src/selection_provider.rs
//
// Abstracts reading the current text selection from the focused UI element.
// Windows uses UI Automation (TextPattern) — no clipboard / Ctrl+C.
// Other platforms currently return None (silent fail).

/// Reads the currently selected text from the focused application.
pub trait SelectionProvider: Send + Sync {
    fn get_selection(&self) -> Option<String>;
    fn is_password_field(&self) -> bool;
}

/// Applies shared gates: password → None, empty/whitespace → None.
pub fn read_selection(provider: &dyn SelectionProvider) -> Option<String> {
    if provider.is_password_field() {
        return None;
    }

    let text = provider.get_selection()?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(trimmed.to_string())
}

#[cfg(any(test, not(target_os = "windows")))]
pub struct NullSelectionProvider;

#[cfg(any(test, not(target_os = "windows")))]
impl SelectionProvider for NullSelectionProvider {
    fn get_selection(&self) -> Option<String> {
        None
    }

    fn is_password_field(&self) -> bool {
        false
    }
}

pub fn default_provider() -> Box<dyn SelectionProvider> {
    #[cfg(target_os = "windows")]
    {
        Box::new(WindowsUiaProvider)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Box::new(NullSelectionProvider)
    }
}

#[cfg(target_os = "windows")]
pub struct WindowsUiaProvider;

#[cfg(target_os = "windows")]
impl SelectionProvider for WindowsUiaProvider {
    fn get_selection(&self) -> Option<String> {
        read_uia_selection()
    }

    fn is_password_field(&self) -> bool {
        focused_is_password().unwrap_or(false)
    }
}

#[cfg(target_os = "windows")]
fn focused_is_password() -> Result<bool, String> {
    use uiautomation::UIAutomation;

    let automation =
        UIAutomation::new().map_err(|e| format!("UIAutomation::new failed: {}", e))?;
    let element = automation
        .get_focused_element()
        .map_err(|e| format!("get_focused_element failed: {}", e))?;
    element
        .is_password()
        .map_err(|e| format!("is_password failed: {}", e))
}

#[cfg(target_os = "windows")]
fn read_uia_selection() -> Option<String> {
    use uiautomation::patterns::UITextPattern;
    use uiautomation::UIAutomation;

    let automation = UIAutomation::new().ok()?;
    let element = automation.get_focused_element().ok()?;

    if element.is_password().unwrap_or(false) {
        return None;
    }

    let pattern: UITextPattern = element.get_pattern().ok()?;
    let ranges = pattern.get_selection().ok()?;
    let range = ranges.into_iter().next()?;
    let text = range.get_text(-1).ok()?;

    if text.trim().is_empty() {
        None
    } else {
        Some(text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct FakeProvider {
        text: Option<String>,
        password: bool,
    }

    impl SelectionProvider for FakeProvider {
        fn get_selection(&self) -> Option<String> {
            self.text.clone()
        }

        fn is_password_field(&self) -> bool {
            self.password
        }
    }

    #[test]
    fn read_selection_returns_none_when_no_selection() {
        let provider = FakeProvider {
            text: None,
            password: false,
        };
        assert!(read_selection(&provider).is_none());
    }

    #[test]
    fn read_selection_returns_none_for_password_field() {
        let provider = FakeProvider {
            text: Some("secret".into()),
            password: true,
        };
        assert!(read_selection(&provider).is_none());
    }

    #[test]
    fn read_selection_returns_none_for_whitespace_only() {
        let provider = FakeProvider {
            text: Some("   \n\t".into()),
            password: false,
        };
        assert!(read_selection(&provider).is_none());
    }

    #[test]
    fn read_selection_trims_surrounding_whitespace() {
        let provider = FakeProvider {
            text: Some("  olá  ".into()),
            password: false,
        };
        assert_eq!(read_selection(&provider).as_deref(), Some("olá"));
    }

    #[test]
    fn read_selection_returns_text_when_available() {
        let provider = FakeProvider {
            text: Some("bom dia".into()),
            password: false,
        };
        assert_eq!(read_selection(&provider).as_deref(), Some("bom dia"));
    }

    #[test]
    fn null_provider_always_returns_none() {
        let provider = NullSelectionProvider;
        assert!(read_selection(&provider).is_none());
    }
}
