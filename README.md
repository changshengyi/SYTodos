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
- [The workspace tree in depth](#the-workspace-tree-in-depth)
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
2. **See what you already have.** Task lists you wrote earlier as `- [ ] something` show up under **All** automatically.
3. **Add your first task.** Type in the box at the top and press Enter. It is written into today's daily note (you can change where, see [Settings](#settings)).
4. **Tick it off.** Click the circle on the left. The block in your note gets ticked too.
5. **Try another view.** Use the **List / Tree / Board** switch in the top right.

That's the whole learning curve. Everything else is optional.

---

## Two spaces

Switch with the **Scope** section in the left sidebar.

| Space | What it is | Good for |
|---|---|---|
| **SiYuan tasks** | Ordinary `- [ ]` task lists in your notes. The plugin gathers all of them automatically. | Things tied to your notes, like "look this up again" inside a book note |
| **Workspace tree** | A dedicated task tree stored in its own document, away from your notes. | Projects, long-term plans, weekly lists - pure task content |
| **All tasks** | Both at once. | Seeing everything on one screen |

Both spaces support nesting, statuses, priorities, due dates, repeats, categories and notes.

---

## The interface

```
┌──────────┬──────────────────────────────────────────────────────────┐
│ SY Todo  │  🔍 Search…             ≡   Group▾  Sort▾  [List|Tree|Board]│
│ 47 tasks ├──────────────────────────────────────────────────────────┤
│          │ Time [Today3][7 days7][All42][Trash2] │ Status [To do][Doing]…│
│ Scope    │ ──────────────────────────────────────────────────────── │
│ ● All    │  ＋ Add a task and press Enter                   [Add]     │
│ ○ SiYuan │ ──────────────────────────────────────────────────────── │
│ ○ Tree   │  Overdue                                                  │
│          │  ▾ □ P0  Fix the login bug        2d late                 │
│  ⚙ Settings│     □ P2  Add test coverage     Today                   │
└──────────┴──────────────────────────────────────────────────────────┘
```

**Left sidebar** - just two jobs: switch scope, open settings.

**Top toolbar**

| Element | What it does |
|---|---|
| Search box | Filters as you type, across title, note, category and document path |
| `≡` | Expands more filters (priority, due, category) |
| Group / Sort | Controls how the list is laid out |
| `List / Tree / Board` (top right) | Switches the view |
| `?` | Shows the keyboard cheat sheet |
| `↶` `↷` | Undo / redo |
| `⟳` | Re-reads the latest data from your notes |

**The row under the search box**

- **Time**: Today / Next 7 days / All / Trash, each with a live count.
- **Status**: To do / Doing / Done / Archived. Click to filter, click again to clear.

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
└ collapse arrow, only when it has children
```

**Detail panel** - select any task and the right panel opens: retitle it, change status, priority, date, repeat and category, and write a multi-line note. Close it with ✕.

---

## Three views

Switch in the top right. All three show the same tasks; edits sync instantly.

### List

Every task from every document in one flat list, grouped by due date (Overdue, Today, Tomorrow, This week, Later, No date). Best for a daily sweep.

- Rows with children get a triangle - click it to fold the whole subtree.
- Switch sorting to **Manual** and drag rows to reorder.

### Tree

Hierarchy only. Best for breaking big things down.

- The **New root task** box at the top adds a node to the top level.
- Drag a task onto another task to make it a child.
- Depth is unlimited.
- Click the triangle to fold a branch.

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
| Add a task | Type in the top box, press Enter (pick priority or "Today" first if you like) |
| Rename a task | Double-click the title, or edit it in the detail panel |
| Complete / reopen | Click the circle on the left |
| Change priority | Click the `P0`–`P3` chip to cycle, or pick one in the detail panel |
| Change status | Drag the card on the board, or use the status chips in the detail panel |
| Set a due date | Detail panel → Due date |
| Make it repeat | Detail panel → Repeat (daily / weekly / monthly …) |
| Add a category | Detail panel → Category, type a new name or pick an existing one |
| Write a note | Detail panel → Note, it saves as you type |
| Add a sub-task | Hover the row, click `+` on the right |
| Change nesting | `Tab` to indent into the task above, `Shift+Tab` to move back out |
| Reorder | Switch sorting to **Manual**, then drag |
| Select several | `Ctrl` (or `Cmd`) + click |
| Bulk complete / delete | Select, then `Space` / `Delete` |
| Delete | Click the bin icon, or select and press `Delete` |
| Restore | Switch time to **Trash**, open the task, press Restore |
| Delete forever | In Trash, use Delete forever or Empty trash |
| Jump to the source | Click the jump button on the row |
| Undo | `Ctrl+Z` (redo: `Ctrl+Shift+Z`) |

---

## Keyboard shortcuts

Click anywhere in the list first, then:

| Key | Action |
|---|---|
| `↑` `↓` | Previous / next task |
| `Enter` | Edit the selected title |
| `Space` | Complete / reopen (applies to every selected task) |
| `Tab` | Indent into the task above |
| `Shift` + `Tab` | Outdent |
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

## The workspace tree in depth

**It creates a document for you**

The first time you open the workspace space, the plugin creates **《SY 待办 任务树》** in your first notebook and keeps the tree there. You can point it at any existing document instead.

**Why a document**

Because then the data is visible and portable. Open that document in SiYuan and you see the whole tree; sync, snapshots, export and full-text search all apply to it. If the plugin breaks or you uninstall it, the tree is still there.

**Unlimited depth**

Root tasks can hold sub-tasks, which can hold sub-tasks, with no limit. Use `Tab`, or drag onto a task in the tree view.

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
| **Tree document** | Where the workspace tree lives. Empty means the plugin creates one. You can also pick an existing document. |
| **Where SiYuan tasks go** | Which document new tasks are written to. Empty means today's daily note. |
| **Default time view** | Where the plugin opens: Today, All, and so on. |
| **Default view mode** | List, tree or board. |
| **Default grouping** | How the list is grouped (due / priority / category / document). |
| **Default sorting** | How the list is sorted (manual / due / priority / created / title). |
| **Advance repeating tasks on complete** | On: completing a weekly task rolls it to next week and keeps it. Off: it is simply marked done. |
| **Include done / archived in All** | Off means All only shows unfinished work. |
| **Reduce motion** | Turns off UI transitions. |
| **Restore defaults** | Resets everything above. |

---

## Where your data lives

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

**The plugin only remembers preferences** - default views, grouping and similar.

**Privacy**: no network calls, no uploads, no account, no telemetry. Your tasks never leave your machine.

**Backups**: use SiYuan's own sync, snapshots or export. There is no private format to back up separately.

---

## FAQ

**I opened it and there are no tasks.**

The plugin only recognises SiYuan **task list** blocks. A plain bullet (`- text`) or hand-typed brackets aren't one. Type `/task list` in a note, or start a line with `[] `, to create a real task block.

**Is this the same data as SiYuan's own checkboxes?**

Yes. There is no second copy - the plugin shows your existing task blocks.

**Will I lose tasks if I uninstall it?**

No. Uninstalling removes the plugin only; every task block stays in your notes.

**Where is the workspace tree? Can I see it?**

Yes. The detail panel shows the document path; click it to jump to the tree document. It's a normal document - open it, edit it, export it, whatever you like.

**Why doesn't dragging do anything?**

Reordering needs sorting set to **Manual**. (In the tree view, dragging onto another task changes nesting instead and works in any sort mode.)

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
