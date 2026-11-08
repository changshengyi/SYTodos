# SYTodos

**SY 待办** · a to-do manager for SiYuan Note | [简体中文](./README_zh_CN.md)

![Preview](preview.png)

Collect the `- [ ]` tasks scattered across your notebooks into one place, then work on them as a list, a tree, or a board. Everything you see is a real block in your notes - the plugin is just a better window onto it.

- **Nothing moves.** Your tasks stay in the notes where you wrote them.
- **Nothing leaves.** Fully local. No account, no network, no telemetry.
- **Nothing is lost.** Uninstall the plugin and every task is still there.
- **Nothing stutters.** Thousands of tasks stay smooth - only visible rows are drawn.

---

## Contents

- [Install](#install)
- [Get started in five minutes](#get-started-in-five-minutes)
- [Two spaces](#two-spaces)
- [The interface](#the-interface)
- [Three views](#three-views)
- [Four statuses](#four-statuses)
- [Common actions](#common-actions)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Search and filters](#search-and-filters)
- [Where nesting comes from](#where-nesting-comes-from)
- [Settings](#settings)
- [Where your data lives](#where-your-data-lives)
- [FAQ](#faq)
- [About the name](#about-the-name)
- [Feedback](#feedback)

---

## Install

**From the marketplace**

`Settings` → `Bazaar` → `Plugins` → search for **SY Todo** → Install.

**Manually**

1. Download `package.zip`;
2. In SiYuan open `Settings` → `Bazaar` → `Downloaded` → `Plugins`;
3. Use the manual install button and pick `package.zip`;
4. **Restart SiYuan once.**

**Enable**

If no checkmark icon appears in the top bar, open `Settings` → `Bazaar` → `Downloaded` → `Plugins` and make sure **SY Todo** is switched on.

Requires SiYuan **3.0.0** or newer. Works on Windows, macOS, Linux, Docker, mobile and in the browser.

---

## Get started in five minutes

1. **Open it.** Click the ✓ icon in the top bar, or press `Ctrl+P` and search for "Open SY Todo".
2. **See what you already have.** You start in the **SiYuan space**. Task lists you wrote earlier as `- [ ] something` show up under **All** automatically.
3. **Add your first task.** Click `+` in the toolbar. In the SiYuan space it is written into today's daily note (you can change where, see [Settings](#settings)); create one in the **Standalone space** instead and it stays inside the plugin.
4. **Tick it off.** Click the circle on the left. In the SiYuan space the block in your note gets ticked too.
5. **Try another view.** Use the **List / Tree / Board** switch in the top right.

That's the whole learning curve. Everything else is optional.

---

## Two spaces

The plugin keeps two **fully isolated** datasets. The left sidebar is nothing but the switch between them.

| Space | Where the data lives | Good for |
|---|---|---|
| **SiYuan space** | Real task-list blocks in your notes. Every edit goes straight back to the block. | Things tied to a note, like "look this up again" inside a book note |
| **Standalone space** | The plugin's own storage file. **No document, no block, no full-text entry, no note sync.** | Pure tasks: projects, weekly plans, scratch lists |

Both share the same list / tree / board views, the same priorities and statuses, but **neither can see the other**: standalone tasks never appear in the SiYuan space, and note tasks never appear in the standalone space.

**The standalone space leaves no trace.** Creating, ticking and deleting tasks there changes nothing in your notes.

**Switching spaces clears the selection and the checkboxes**, so a quick multi-select can't leak into the other space.

---

## The interface

```
┌──────────────┬──────────────────────────────────────────────────────┐
│ SY Todo      │  🔍 Search…      ≡   +        [List|Tree|Board] ? ↶ ↷ ⟳│
│ 47 tasks     ├──────────────────────────────────────────────────────┤
│              │  ▾ □ P0  Fix the login bug     2d late  work  …/daily│
│ Spaces       │    ▾ □ P2  Reproduce the issue  Today                │
│ ●SiYuan   42 │        □ P3  Add a regression    Tomorrow            │
│ ○Standalone 5│  □ P2  Add test coverage        Today                │
│              │                                                      │
│  ⚙ Settings  │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

**Left sidebar** - only switches between the two data spaces (each with a task count), plus the settings entry. Time filters are not here.

**Top toolbar**

| Element | What it does |
|---|---|
| Search box | Filters as you type, across title, note, category and document path |
| `≡` | Expands filters and layout: status, priority, due, category, grouping, sorting |
| `+` | Creates a task |
| `List / Tree / Board` (top right) | Switches the view |
| `?` | Shows the keyboard cheat sheet |
| `↶` `↷` | Undo / redo |
| `⟳` | Re-reads the latest data from your notes |

**Inside `≡`**

- **Time**: Today / Next 7 days / All / Trash, with counts for the current space.
- **Status**: To do / Doing / Done / Archived. Click to filter, click again to clear.
- **Priority**: any combination of `P0`~`P3`.
- **Due**: Any / Overdue / Due today / This week / No date.
- **Group**: None / Due / Priority / Category / Document.
- **Sort**: Manual / Due / Priority / Created / Title.

**Anatomy of a row**

```
▾  □  P1  Write the report             Today  ↻  2/5  ≡  #work  …/Journal/2026-10
↑  ↑   ↑   ↑                            ↑     ↑   ↑    ↑   ↑
│  │   │   └ title (double-click to edit)│     │   │    │   └ source document
│  │   │                                │     │   │    └ category
│  │   │                                │     │   └ has a note
│  │   │                                │     └ repeats
│  │   │                                └ due date
│  │   └ priority (click to cycle)
│  └ complete (click to tick)
└ collapse arrow: Tree view only, when the task has children
```

**Detail panel** - select any task and the right panel opens: retitle it, change status, priority, date, repeat and category, and write a multi-line note. Close it with ✕.

---

## Three views

Switch in the top right. All three show the same tasks; edits sync instantly.

### List

Every matching task from every document appears as one flat row, ungrouped by default and ordered by the current sort. Best for a daily sweep.

- **No parent indentation and no fold controls**; parents and children are independent rows.
- Grouping adds section headers only; rows inside each group remain flat and hierarchy does not change their order.
- Use Tree when you need to change hierarchy, fold branches or drag to reorder.

### Tree

Hierarchy only. Best for breaking big things down.

- `+` in the toolbar adds a root task; hover any task and use its `+` to add a sub-task.
- Drop on the **middle** of a row to nest it; drop on the **top/bottom edge** to reorder siblings.
- Depth is unlimited and indentation grows with it.
- Click the triangle, or press `←` / `→`, to fold a branch.
- Parents filtered out by the current view are kept as dimmed context, so the tree never falls apart.

### Board

Four columns by status: To do / Doing / Done / Archived.

- Drag a card to another column to change its status.
- Dropping into **Done** also ticks the block in your note.
- Cards show priority, due date, sub-task progress and category.

---

## Four statuses

| Status | Means | How it shows in your note |
|---|---|---|
| **To do** | Not started | Unticked |
| **Doing** | In progress | Unticked (status lives in the block attributes) |
| **Done** | Finished | **Ticked** |
| **Archived** | Finished, out of sight | Unticked (status lives in the block attributes) |

This mapping is deliberate, so the plugin never fights with SiYuan itself:

- Tick a task in your note → it becomes **Done** here immediately.
- Drag a card to **Done** → the block in your note gets ticked.
- **Doing** and **Archived** don't touch the checkbox, so reading your notes is never disturbed.

---

## Common actions

| I want to… | How |
|---|---|
| Add a task | Click `+` in the toolbar, fill the fields and confirm (`Ctrl/Cmd + Enter`) |
| Rename a task | Double-click the title, or edit it in the detail panel |
| Complete / reopen | Click the circle on the left |
| Change priority | Click the `P0`–`P3` chip to cycle, or pick one in the detail panel |
| Change status | Drag the card on the board, or use the status chips in the detail panel |
| Set a due date | Detail panel → Due date |
| Make it repeat | Detail panel → Repeat (daily / weekly / monthly …) |
| Add a category | Detail panel → Category, type a new name or pick an existing one |
| Write a note | Detail panel → Note, it saves as you type |
| Add a sub-task | Hover the row, click `+` on the right |
| Change nesting (Tree only) | `Tab` to indent into the task above, `Shift+Tab` to move back out, or drop onto the middle of another row |
| Reorder (Tree only) | Drop on the top/bottom edge of another row; the new order is written back to your notes |
| Select several | `Ctrl` (or `Cmd`) + click |
| Bulk complete / delete | Select, then `Space` / `Delete` |
| Delete | Click the bin icon, or select and press `Delete` |
| Restore | Switch time to **Trash**, open the task, press Restore |
| Delete forever | In Trash, use Delete forever or Empty trash |
| Jump to the source | Click the jump button on the row |
| Undo | `Ctrl+Z` (redo: `Ctrl+Shift+Z`) |

**Subtree rules:** trashing, restoring and permanently deleting a parent applies to all its descendants. Permanent deletion cannot be undone. Folding, indenting and drag ordering are Tree-only; drag ordering also requires **Manual** sorting.

**Delete confirmation:** moving to trash, deleting forever, emptying trash, and bulk/keyboard deletion all show a confirmation dialog. Cancelling never changes task data. The filter button uses a funnel icon.

---

## Keyboard shortcuts

Click anywhere in the list first, then:

| Key | Action |
|---|---|
| `↑` `↓` | Previous / next task |
| `←` `→` (Tree only) | Collapse / expand the selected task's children |
| `Enter` | Edit the selected title |
| `Space` | Complete / reopen (applies to every selected task) |
| `Tab` (Tree only) | Indent into the task above |
| `Shift` + `Tab` (Tree only) | Outdent |
| `N` | Jump to the input box |
| `Delete` | Move to trash |
| `Ctrl/Cmd` + `Z` | Undo |
| `Ctrl/Cmd` + `Shift` + `Z` | Redo |
| `R` | Refresh data |
| `Esc` | Cancel editing, clear selection |

---

## Search and filters

The search box and the filters below it **stack**. Everything updates as you type.

| I want to… | Set it to |
|---|---|
| See what's left today | Time: **Today** |
| Catch this week's deadlines | Time: **Next 7 days**, Status: To do + Doing |
| Find what's slipping | `≡` → Due: **Overdue**, Priority: `P0` |
| See everything for one project | Type the project name, or set a category in `≡` |
| Clean up | Time: **Trash**, then Empty trash |
| Focus on what's in flight | Status: **Doing** |

Not sure what's currently applied? Open `≡` and press **Clear filters**.

---

## Where nesting comes from

**Parent/child is just an indented list in your note**

Indent a task-list item in SiYuan and it becomes a child of the item above it. The plugin reads that structure directly instead of keeping a tree of its own:

```markdown
- [ ] Ship the release
  - [ ] Fix the compatibility issue
  - [ ] Finish the release notes
- [ ] Write up this week's meeting
```

In the plugin, `Ship the release` has two sub-tasks, and `Write up this week's meeting` sits next to it.

**Three ways to change nesting**

1. Indent in the note (most natural - the plugin syncs instantly);
2. `Tab` / `Shift+Tab` in the plugin's Tree view;
3. Drop a task onto the middle of another row in the Tree view.

**The standalone space has no note to lean on**

Its hierarchy is maintained entirely by the plugin and stored in its own data file. Tree-view operations are the same (`Tab` / `Shift+Tab`, dragging, changing the parent in the detail panel) - they just never touch a block. List always shows those tasks flat.

**Unlimited depth**

In Tree view, sub-tasks can hold sub-tasks and indentation deepens with each level. Nothing stops at level five.

**When a parent is filtered out**

Tree view keeps those parents as dimmed context so children never jump to the root; List adds no ancestors and shows only the matching tasks as flat rows.

**A way to organise it that works**

- Keep top-level roots as **projects or areas**, not single actions.
- Put concrete actions on the leaves so you can tick them one by one.
- Use priority to mark which branch must move this week.
- Archive finished branches regularly - the board gets much easier to read.

---

## Settings

Open from the bottom of the left sidebar.

| Setting | What it does |
|---|---|
| **Open with** | Which data space the plugin opens in. |
| **SiYuan space - where new tasks go** | Which document new root tasks are written to. Empty means today's daily note. Sub-tasks always go under their parent. The standalone space ignores this setting. |
| **Default view** | Where the plugin opens: Today, All, and so on. |
| **Default view mode** | List, tree or board. |
| **Default grouping** | How the list is grouped (due / priority / category / document). |
| **Default sorting** | How the list is sorted (manual / due / priority / created / title). |
| **Advance repeating tasks on complete** | On: completing a weekly task rolls it to next week and keeps it. Off: it is simply marked done. |
| **Include done / archived in All** | Off means All only shows unfinished work. |
| **Reduce motion** | Turns off UI transitions. |
| **Restore defaults** | Resets everything above. |

---

## Where your data lives

It depends on the space you are in.

### SiYuan space

**The tasks** are ordinary task-list blocks inside your notes.

**Priority, status, due date and friends** live in block attributes. Select a block in SiYuan, open its block menu → Attributes, and you'll see them:

| Attribute | Meaning |
|---|---|
| `custom-bt-p` | Priority `P0`–`P2`; absent means `P3` |
| `custom-bt-status` | `doing` or `archived` |
| `custom-bt-due` | Due date |
| `custom-bt-repeat` | Repeat rule |
| `custom-bt-cat` | Category |
| `custom-bt-note` | Note |
| `custom-bt-sort` | Manual sort weight |
| `custom-bt-trash` | Present means it's in the trash |

### Standalone space

**The tasks live in the plugin's own storage only** - no document, no block, nothing indexed by full-text search, nothing carried by note sync. Version 0.4.0 uses a validated v2 archive, keeps the last successful backup and reads the 0.3.0 archive automatically. Every mutation waits for the real save before it is shown as committed. Back up this storage before uninstalling the plugin.

### Shared

**The plugin only remembers preferences** - default space, default views, grouping and similar.

**Privacy**: no network calls, no uploads, no account, no telemetry. Your tasks never leave your machine.

**Backups**: use SiYuan's own sync, snapshots or export for the SiYuan space; the standalone space needs its plugin storage file backed up.

---

## FAQ

**I opened it and there are no tasks.**

Check which space the sidebar is on first:

- **Standalone space**: it starts empty by design - click `+` to create the first task;
- **SiYuan space**: the plugin only recognises SiYuan **task list** blocks. A plain bullet (`- text`) or hand-typed brackets aren't one. Type `/task list` in a note, or start a line with `[] `, to create a real task block.

**Is this the same data as SiYuan's own checkboxes?**

In the SiYuan space, yes - there is no second copy, the plugin shows your existing task blocks. In the standalone space, no: those tasks have no block behind them.

**Will standalone tasks ever be written into my notes?**

No. That space is read from and written to the plugin's own storage only: no document, no block attributes, no full-text entry.

**Where did my old standalone tasks go after the upgrade?**

Before 0.3.0 the standalone space was actually backed by a document called "SY 待办 任务树". Those tasks are now ordinary note tasks and show up in the SiYuan space; the standalone space restarts empty and the two never mix again. That document is never deleted - keep or remove it yourself.

**Will I lose tasks if I uninstall it?**

SiYuan space: no, uninstalling removes the plugin only and every task block stays in your notes. Standalone space: yes - that data belongs to the plugin, so back it up if you rely on it.

**What happens when I drag a task?**

Drop on the **middle** of a row and it becomes that task's child; drop on the **top/bottom edge** and it swaps sibling order with it. The drop zone is highlighted live - a full outline means nesting, a line on the edge means reordering. Both changes are written back to the real block structure in your notes.

**Does the plugin create documents of its own?**

No. It only appends task-list blocks into the document you point it at (today's daily note by default). No dedicated document is ever created behind your back.

**I changed the status on the board but the checkbox didn't change.**

Dropping into **Done** ticks it. **Doing** and **Archived** deliberately leave the checkbox alone so reading your notes stays undisturbed - those states live in block attributes.

**Does it work on mobile?**

Yes. The layout adapts to narrow screens and the detail panel becomes a drawer.

**Will it get slow with thousands of tasks?**

No. Only the rows currently on screen are rendered; the rest are drawn as you scroll.

**Completing a repeating task didn't create a new one.**

By design it rolls the date forward instead of duplicating. Turn off "Advance repeating tasks on complete" if you'd rather have it marked done.

**Can I edit several tasks at once?**

Yes - `Ctrl` (or `Cmd`) + click to select, then `Space` to complete or `Delete` to trash them all.

**Does it support English?**

Yes. The UI follows SiYuan's language setting; Chinese and English are bundled.

**Does it follow dark themes?**

Yes. Colours come from SiYuan's theme variables, so light, dark and third-party themes all adapt automatically.

---

## About the name

**SY** carries two meanings, and they happen to coincide:

- it is the abbreviation of **SiYuan**;
- it is also our initials - **S** for Song Lijuan, my wife, and **Y** for Yi Changsheng, me.

**Todos** is just "to-dos".

So SYTodos reads both as "SiYuan's todos" and "our todos". Naming a tool we use every day after something we both recognise felt just right.

## Feedback

Issues and ideas are welcome:

<https://github.com/changshengyi/SYTodos/issues>

Please include your SiYuan version, plugin version, steps to reproduce, and a screenshot if you can - it makes fixes much faster.

## License

[MIT](./LICENSE)
