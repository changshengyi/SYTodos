# BlockTodo

**English** | [简体中文](./README_zh_CN.md)

> A **block-native** todo plugin for SiYuan. Every task is a real task-list block in your notes, and the plugin is just one view of it.

## Why another one

Most todo plugins in the SiYuan bazaar keep their data in plugin-private storage: tasks created in the plugin never show up in your notes, and `- [ ]` blocks you write in a note never show up in the plugin. Users end up maintaining two lists.

BlockTodo inverts that: **task-list blocks are the only source of truth**.

- A task created in the plugin is written as a real `- [ ] xxx` block (by default into today's daily note);
- Type `- [ ] Buy milk` in any note and the plugin sees it immediately;
- Extension fields (priority, due date, repeat, category, note) live in block attributes, never polluting the markdown body;
- Uninstalling the plugin never touches your notes.

## Interface organisation

```
┌──────────┬────────────────────────────────┬──────────┐
│ Views    │ Toolbar / Quick add / List     │ Detail   │
│ Today 3  │  Overdue · Today · Tomorrow    │ Priority │
│ 7 days 7 │  □ P1  Write report      Today │ Due date │
│ All 42   │  □ P0  Fix prod bug   2d late  │ Repeat   │
│ Done 9   │    □ P2 Add test cases  Today  │ Category │
│ Trash 2  │  Tomorrow                      │ Note     │
└──────────┴────────────────────────────────┴──────────┘
```

- The sidebar organises tasks by **time semantics** with live counts.
- The list groups by **due date / priority / category / document** and sorts by **manual / due / priority / created / title**.
- The detail drawer holds long-form notes so the list stays scannable.
- Below 720px the layout collapses into top nav + list + drawer.

## Interaction

| Action | How |
|---|---|
| Complete / reopen | Click the circle, or press `Space` |
| Edit title | Double click, or press `Enter` |
| Change priority | Click the P0-P3 chip to cycle, or pick in the detail panel |
| Set due today | Tick "Today" in the quick-add row |
| Indent as subtask | `Tab` (moves the real block) |
| Outdent | `Shift+Tab` |
| Move selection | `Up` / `Down` |
| New task | `N` |
| Move to trash | `Delete` |
| Undo / redo | `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` |
| Multi-select | `Ctrl/Cmd+click` |
| Drag reorder | Switch sorting to Manual, then drag rows |
| Jump to source | Row action button, or the document link in the detail panel |

Completing a parent cascades to all descendants; reopening any child restores the parents.

## Performance

| Technique | Detail |
|---|---|
| Single query with `ial` | One SQL call returns blocks *and* all their attributes, eliminating the N+1 attribute requests; older kernels fall back to concurrency-limited lazy loading |
| Incremental transaction sync | Subscribes to kernel `transactions` and re-queries only affected blocks - **no timers, no full-snapshot polling** |
| Windowed rendering | Only rows inside the viewport (plus buffer) render; scrolling is throttled with `requestAnimationFrame` |
| Optimistic updates | Local state updates first, then persists; failures roll back and notify |
| Write de-duplication | Only changed attributes are written; settings saves are coalesced over 400ms |
| No runtime dependencies | Vue only, ~110KB output |

## Data model

| Block attribute | Meaning |
|---|---|
| `custom-bt-p` | Priority `P0`..`P2`; absent means P3 |
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
2. Create a GitHub Release whose tag equals the plugin version (e.g. `0.1.0`) and attach `package.zip`.
3. Fork [siyuan-note/bazaar](https://github.com/siyuan-note/bazaar), append one line `your-username/siyuan-plugin-blocktodo` to `plugins.txt`, and open a PR against `main`.
4. One PR per package; CI validates the release, `package.zip` and manifest fields. After merging, the index updates within minutes (restart SiYuan once).

Later releases need no new PR - the index refreshes every 1-3 hours.

## License

[MIT](./LICENSE)
