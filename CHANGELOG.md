# Changelog

All notable changes to this project are documented in this file.

## 0.1.0

- Initial release.
- Block-native storage: every task is a real SiYuan task-list block; extension data lives in `custom-bt-*` block attributes.
- Views: Today, Next 7 days, All, Done, Trash, each with live counts.
- Grouping by due date / priority / category / document, sorting by manual / due / priority / created / title.
- P0-P3 priorities, due dates, repeat rules, categories, notes, one-level-plus subtasks with real block nesting.
- Virtualized list rendering and incremental transaction-based sync instead of polling.
- Keyboard-first interaction with an undo stack.
- Settings panel with a real document picker.
- Light/dark theme aware and narrow-screen layout.
