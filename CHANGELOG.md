# Changelog

All notable changes to this project are documented in this file.

## 0.2.0

- **Two data spaces**: note tasks (`- [ ]` blocks anywhere) and an unlimited-depth workspace tree stored in a dedicated document.
- **Four-state status model**: To do / Doing / Done / Archived, derived from the block checkbox plus `custom-bt-status`, so native ticking stays in sync.
- **Three view modes**: list (virtualized, grouped), tree (collapsible, unlimited nesting, drag-to-reparent) and board (four status columns, drag between columns to change status).
- **Advanced search**: status, priority, due, category and keyword filters that stack.
- Sidebar reorganised into three axes: scope x view mode x time view.
- Detail panel gained a status switcher; tree view gained a root-task creator.
- Space membership is stored so the workspace tree survives document moves.
- Performance: child-task statistics, grouping and sorting now share one cached pass per data version; collapsing a node no longer rescans the whole index.

## 0.1.0

- Initial release.
- Block-native storage: every task is a real SiYuan task-list block; extension data lives in `custom-bt-*` block attributes.
- Views: Today, Next 7 days, All, Done, Trash, each with live counts.
- Grouping by due date / priority / category / document, sorting by manual / due / priority / created / title.
- P0-P3 priorities, due dates, repeat rules, categories, notes, subtasks with real block nesting.
- Virtualized list rendering and incremental transaction-based sync instead of polling.
- Keyboard-first interaction with an undo stack.
- Settings panel with a real document picker.
- Light/dark theme aware and narrow-screen layout.
