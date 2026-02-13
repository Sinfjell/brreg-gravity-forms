# Changelog

All notable changes to this project will be documented in this file.

## 1.2.0

### Added
- **Bypass mode for private payment**: New "Bypass Field CSS Class" and "Bypass Value" settings. When the configured field (e.g. "Betaler du privat?") matches the bypass value (e.g. "Ja"), only the org number is populated from Brreg — address and email fields stay editable for manual entry.

## 1.1.0

### Added
- **Invoice Email field**: New output field that auto-populates with company email (`epostadresse`) from Brreg API.
- **Per-field uneditable control**: Replace global checkboxes with a settings table allowing individual control over which fields should be locked.
  - Configure "Make Uneditable" and "Uneditable After Population" independently for each output field.
  - Select All / Deselect All links for quick bulk selection.

### Changed
- Admin settings UI now displays a consolidated table showing CSS class, uneditable, and uneditable-after-population settings for each field.
- Backward compatibility: Existing installations with global uneditable settings are automatically migrated to per-field settings.

## 1.0.1

- **Fix**: Autocomplete now initializes reliably for logged-out users on pages with multiple Gravity Forms and/or multi-page forms.
  - Scope field lookups to the correct `.gform_wrapper` (prevents binding to the wrong form/field).
  - Keep observing DOM changes (including `class`/`style` attribute changes) so initialization also happens when later form pages/fields become visible.

## 1.0.0

- Initial release.

