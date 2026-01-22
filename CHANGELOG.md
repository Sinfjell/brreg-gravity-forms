# Changelog

All notable changes to this project will be documented in this file.

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

