# Changelog

All notable changes to this project will be documented in this file.

## 1.0.1

- **Fix**: Autocomplete now initializes reliably for logged-out users on pages with multiple Gravity Forms and/or multi-page forms.
  - Scope field lookups to the correct `.gform_wrapper` (prevents binding to the wrong form/field).
  - Keep observing DOM changes (including `class`/`style` attribute changes) so initialization also happens when later form pages/fields become visible.

## 1.0.0

- Initial release.

