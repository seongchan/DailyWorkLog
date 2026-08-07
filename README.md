# Daily Work Log

An Obsidian plugin that visualizes daily time tracking (Events) and To-Do lists directly from your daily markdown notes — no YAML frontmatter required.

*[한국어 안내는 README.ko.md를 참고하세요.](./README.ko.md)*

## Features

- **Grid timeline**: a 10-minute-cell grid in the sidebar — drag across cells to log a new time block, click an existing block to edit it.
- **Categories**: color-coded categories (5 built-in — Work/Study/Rest/Reading/Exercise — plus up to 10 custom), stored as a `[Category]` tag right in the note body.
- **Collapsible To-Do panel**: docked at the bottom of the sidebar, with inline add/check/delete.
- **PDF / HTML export**: turn any day into a standalone, printable HTML file.
- **Configurable daily note folder**: notes don't have to live at the vault root, with folder autocomplete in settings.
- **Minimal metadata**: everything is read from three plain markdown headings — no frontmatter needed.
- **Multi-language, backward-compatible markers**: notes use `Event` / `ToDo` / `Diary` (or Korean `이벤트` / `할일` / `다이어리`) headings; the legacy underscore-prefixed spelling (`_Event` etc.) from older notes is still recognized so nothing breaks.
- **Automatic UI language detection**: picked up from Obsidian's own language on first run, overridable in settings.
- **Two independent themes**: a Light/Dark toggle just for the sidebar (separate from Obsidian's own theme, popups always follow the system theme), and Work Insights that follows Obsidian's theme automatically.
- **Work Insights**: a vault summary — total notes in configured folder, current streak, time window filtering (7d/30d/90d/All), To-Do completion rate, total event time and daily average, category time breakdown visualization (Multi-Segment Progress Bar), and recent note activity history.


## Daily Note Format

Daily notes must be named `YYYY-MM-DD.md`. A new note created through the plugin looks like this:

```markdown
# Event

- 9:00 - 10:30 [Work] Team meeting

# ToDo

- [x] Submit weekly report
- [ ] Review pull requests

# Diary

Free-form notes go here — not parsed or shown in the sidebar.
```

- The `[Category]` tag right after the time range is optional — `- 9:00 - 10:30 Team meeting` (no category) still works.
- Blocks can appear in any order.
- Notes written before this format existed (`# _Event` etc., with a leading underscore) keep working — the plugin recognizes both spellings.
- If none of the three headings are present, the plugin falls back to treating any `- [ ]`/`- [x]` line as a To-Do and any `- HH:mm - HH:mm ...` line as an Event, anywhere in the file.

## Installation

This plugin isn't published on the Community Plugins browser yet. To install manually:

1. Download `main.js`, `manifest.json`, and `styles.css` from a [release](../../releases) (or build them yourself — see below).
2. Copy the three files into `<your vault>/.obsidian/plugins/daily-work-log/`.
3. In Obsidian, go to **Settings → Community plugins**, turn off Restricted mode if needed, and enable **Daily Work Log**.

### Building from source

```bash
npm install
npm run build   # outputs dist/main.js, dist/manifest.json, dist/styles.css
```

For active development, use `npm run dev` instead — it rebuilds automatically on every change (esbuild watch mode).

> #### **[!TIP]**  
> **Switching from DayTime Tracker?** That plugin stores its data as `timeline-logs` / `timeline-todos` YAML frontmatter properties instead of plain body text. `scripts/migrate-from-daytimetracker.mjs` converts your existing daily notes to this plugin's format.
>
> This script is only in the source repository, not in the release download (the release only contains `main.js`/`manifest.json`/`styles.css`) — you'll need to clone this repo and run `npm install` first:
> ```bash
> git clone https://github.com/seongchan/DailyWorkLog.git
> cd DailyWorkLog
> npm install
> node scripts/migrate-from-daytimetracker.mjs <path-to-your-vault>            # dry run — writes nothing, just previews
> node scripts/migrate-from-daytimetracker.mjs <path-to-your-vault> --write    # actually rewrite the files
> ```
> Always run the dry run first and back up your vault before using `--write` — this rewrites daily notes in place and there's no undo. See the comment at the top of the script for exactly what does and doesn't get migrated.

## Usage

### From the sidebar

- **Work Insights**: click the ribbon icon (gauge), or run **"Open Work Insights"** from the Command Palette. Opens as a normal tab in the main workspace.
- **Sidebar**: click the ribbon icon (calendar-clock), or run **"Open sidebar"** from the Command Palette (`Cmd/Ctrl+P`). You can assign either a hotkey in **Settings → Hotkeys**.
- Drag across the grid to log a new time block; click an existing block to edit or delete it.
- Use the **Today** button in the sidebar header to open (or create) today's note; **Print** exports the current day as a printable HTML file.

### Directly in the note

You don't need the sidebar at all — the sidebar is just a UI on top of plain markdown, so typing directly into the note body works exactly the same way. Under each heading, add lines in this format:

```markdown
# Event

- 9:00 - 10:30 [Work] Team meeting
- 14:00 - 14:30 Quick call with no category

# ToDo

- [ ] Something to do
- [x] Something already done
```

- `- HH:mm - HH:mm [Category] description` for an Event. The `[Category]` part is optional; the category name must match one of the names configured in **Settings → Category Management** to pick up its color (an unrecognized or missing category just shows as uncategorized).
- `- [ ] text` / `- [x] text` for a To-Do, same as a normal Obsidian checkbox.
- Save the file (or just keep typing — Obsidian autosaves) and the sidebar/Work Insights pick up the change automatically.


## Settings

- **Day Start Hour / Day End Hour**: the hour range shown on the grid.
- **Daily Note Folder**: where new daily notes are created (vault root by default), with folder autocomplete.
- **Language**: auto-detected from Obsidian's own UI language on first run. Controls the marker labels inserted into new notes and all sidebar/settings text — existing notes in either language keep parsing correctly regardless of this setting.
- **Background Theme Mode**: Light or Dark, for the sidebar only.
- **Category Management**: add, rename, recolor, or delete categories, or reset to the defaults.

## Development

```bash
npm test    # run the Vitest unit test suite
npm run build   # type-check (tsc) + production build
```

## Changelog

### 0.4.0 (2026-08-07)

- **Redesigned Work Insights view**:
  - Overhauled the summary view into a refined UI.
  - **Configurable Folder Filtering (`dailyNoteFolder`)**: collects notes strictly from the folder specified in settings, rather than the entire vault.
  - **Time Window Filter**: filter statistics by Last 7 Days, 30 Days, 90 Days, or All Time in real-time.
  - **Category Time Breakdown**: visual multi-segment progress bar and legend grid reflecting configured category colors.
  - **Recent Note Activities**: card-based history list displaying per-note To-Do progress, top category badge, and recorded event time (click to open note).
  - **Renamed**: updated the view name from 'Dashboard' to 'Work Insights' for better clarity.

### 0.3.1 (2026-08-07)


- **Added a DayTime Tracker migration script**: `scripts/migrate-from-daytimetracker.mjs` — converts existing daily notes written by DayTime Tracker (stored in `timeline-logs`/`timeline-todos` frontmatter properties) into this plugin's body-text format. Not included in the release download — you need to clone the source repository to use it (see the tip under "Installation" above).

### 0.3.0 (2026-08-05)

- Sidebar rebuilt as a 10-minute grid timeline (drag to select a time range), replacing the old list-and-calendar layout. Calendar date navigation has been removed — use Obsidian's own file explorer or quick switcher to jump to another day's note.
- Added color-coded categories (5 built-in + up to 10 custom), stored as an optional `[Category]` tag in each Event line.
- Simplified the block markers to `Event` / `ToDo` / `Diary` (dropping the leading underscore, which rendered as italics in some viewers). Notes written with the old `_Event` / `_ToDo` / `_Diary` markers keep working.
- Added PDF/HTML export for a single day's timeline and To-Do list.
- Added a configurable daily note folder (with autocomplete), instead of always using the vault root.
- Added automatic UI language detection on first run.
- Expanded the settings screen: hour range, daily note folder, language, sidebar theme, and full category management.

## License

MIT
