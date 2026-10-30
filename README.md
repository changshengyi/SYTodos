# SY Todo

**English** | [简体中文](./README_zh_CN.md)

> A **block-native** todo plugin for SiYuan. Two data spaces, three view modes, four status columns - and the data is always real task-list blocks inside your notes.

## Two data spaces

| Space | Meaning |
|---|---|
| **SiYuan tasks** | Every `- [ ]` task-list block you wrote anywhere. Aggregated automatically; editing one side updates the other. |
| **Workspace tree** | An **unlimited-depth** task tree stored in a dedicated document (`SY 待办 任务树`) the plugin creates for you, independent of your notes. |

Both live as real SiYuan blocks: uninstalling the plugin never loses a task. Extension fields (priority, status, due date, repeat, category, note) live in block attributes, never polluting the markdown body.

## Three view modes

| Mode | Purpose |
|---|---|
| **List** | Flat, cross-document, grouped by due / priority / category / document; virtualized for huge datasets. |
| **Tree** | Hierarchy only: any node grows children, nodes collapse; drag a task onto another node to make it a child. |
| **Board** | Four status columns (To do / Doing / Done / Archived); drag a card to another column to change its status. |

### Layout

| Area | Content |
|---|---|
| Left sidebar | **Scope**: all tasks / SiYuan tasks / workspace tree, plus the settings entry |
| Content toolbar | Search, grouping and sorting; **top right** holds the view switch (list / tree / board) |
| Below the search bar | **Time** (today / next 7 days / all / trash) and **status** filters; `≡` expands priority / due / category |

The three axes combine freely: scope x view mode x time and filters.

## Status model

Status combines the block checkbox with an attribute, so it stays compatible with native note behaviour while expressing more stages:

| Status | Storage |
|---|---|
| To do | `[ ]` with no status attribute |
| Doing | `[ ]` + `custom-bt-status="doing"` |
| Done | `[x]` (the native checkbox) |
| Archived | `[ ]` + `custom-bt-status="archived"` |

Ticking a task inside SiYuan instantly shows as Done here; dragging a card to Done on the board ticks the block too.

## Advanced search

Open the filter panel from the `≡` button in the toolbar. All conditions stack:

- **Status** multi-select (each with a live count badge)
- **Priority** multi-select
- **Due**: overdue / due today / this week / no date
- **Category contains** (substring)
- The top search box matches **title / note / category / document path** in real time

## Interaction

| Action | How |
|---|---|
| Complete / reopen | Click the circle, or press `Space` |
| Edit title | Double click, or press `Enter` |
| Change priority | Click the P0-P3 chip to cycle |
| Change status | Drag the card on the board, or use the detail panel |
| Add subtask | `+` on the row; or drop a tree node onto another node |
| Collapse / expand | Caret at the start of the row |
| Indent / outdent | `Tab` / `Shift+Tab` (moves the real block) |
| Move selection | `Up` / `Down` |
| New task | `N` |
| Move to trash | `Delete` |
| Undo / redo | `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` |
| Multi-select | `Ctrl/Cmd+click` |
| Drag reorder | Switch sorting to Manual, then drag rows |

Completing a parent cascades to all descendants; reopening any child restores the parents.

## Performance

| Technique | Detail |
|---|---|
| Single query with `ial` | One SQL call returns blocks *and* their attributes, eliminating N+1 attribute requests; older kernels fall back to concurrency-limited lazy loading |
| Incremental transaction sync | Subscribes to kernel `transactions` and re-queries only affected blocks - **no timers, no full-snapshot polling** |
| Windowed rendering | Only rows inside the viewport (plus buffer) render; scrolling throttled with `requestAnimationFrame` |
| Shared derived caches | Child stats, grouping and sorting are computed once and reused by every row and card |
| Optimistic updates | Local state first, then persist; failures roll back and notify |
| Write de-duplication | Only changed attributes are written; settings saves coalesce over 400ms |
| No runtime dependencies | Vue only, ~130KB output |

## Data model

| Block attribute | Meaning |
|---|---|
| `custom-bt-p` | Priority `P0`..`P2`; absent means P3 |
| `custom-bt-status` | `doing` / `archived`; absent means to-do |
| `custom-bt-due` | Due date, `YYYY-MM-DD` |
| `custom-bt-repeat` | Repeat rule `1d` `3d` `1w` `2w` `1m` `3m` `1y` |
| `custom-bt-cat` | Category |
| `custom-bt-note` | Note text |
| `custom-bt-sort` | Manual sort weight |
| `custom-bt-trash` | Present means trashed |

Deleting is soft (writes `custom-bt-trash`). Only "Delete forever" removes the block from your notes.

## Development

```bash
npm install
npm run assets       # generate icon.png / preview.png
npm run typecheck    # vue-tsc
npm run build        # emits dist/ and package.zip
```

Local development against a running SiYuan:

```bash
# .env.local
VITE_SIYUAN_WORKSPACE_PATH=/path/to/siyuan/workspace
npm run dev
```

Then disable and re-enable the plugin in SiYuan.

> Don't put the source folder directly under `data/plugins/` - it gets synced and is deleted when the plugin is uninstalled.

## Publishing to the bazaar

> Clarification: this PR **registers your own repository in SiYuan's official bazaar index**.
> It is *not* a code contribution to another plugin author. Since this project is fully
> independent, you never need to fork someone else's plugin or ask for permission.
> If you only want to use it yourself, skip this section entirely and install
> `package.zip` locally via `Settings -> Bazaar -> Downloaded -> Plugin -> Install manually`.

1. Set `author` and `url` in `plugin.json` to your own GitHub info (`name` must match the repo name).
2. Create a GitHub Release whose tag equals the plugin version (e.g. `0.2.0`) and attach `package.zip`.
3. Fork [siyuan-note/bazaar](https://github.com/siyuan-note/bazaar), append one line `your-username/siyuan-plugin-blocktodo` to `plugins.txt`, and open a PR against `main`.
4. One PR per package; CI validates the release, `package.zip` and manifest fields. After merging, the index updates within minutes (restart SiYuan once).

Later releases need no new PR - the index refreshes every 1-3 hours.

## License

[MIT](./LICENSE)
