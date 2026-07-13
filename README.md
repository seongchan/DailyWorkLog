# Daily Work Log

An Obsidian plugin that visualizes daily time tracking (Events) and To-Do lists directly from your daily markdown notes — no YAML frontmatter required.

*[한국어 안내는 README.ko.md를 참고하세요.](./README.ko.md)*

## Features

- **Sidebar view**: a monthly calendar, an Event (timeline) section, and a To-Do section — all in the right sidebar.
- **Inline editing**: add/edit/delete Events and To-Dos directly from the sidebar, without opening the note.
- **Minimal metadata**: everything is read from three plain markdown headings — no frontmatter needed.
- **Multi-language markers**: notes can use English (`_Event` / `_ToDo` / `_Diary`) or Korean (`_이벤트` / `_할일` / `_다이어리`) headings, recognized simultaneously regardless of your settings.
- **Two independent themes**: a Light/Dark toggle just for the sidebar (separate from Obsidian's own theme), and a Dashboard that follows Obsidian's theme automatically.
- **Dashboard**: a vault-wide summary — total notes, current streak, date range, and your last-30-days To-Do completion rate and total Event time.
- **UI language**: English or Korean, switchable in settings.

## Daily Note Format

Daily notes must be named `YYYY-MM-DD.md`. A new note created through the plugin looks like this:

```markdown
# _Event

- 9:00 - 10:30 Team meeting

# _ToDo

- [x] Submit weekly report
- [ ] Review pull requests

# _Diary

Free-form notes go here — not parsed or shown in the sidebar.
```

- Blocks can appear in any order.
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

## Usage

- **Dashboard**: click the ribbon icon (calendar-clock), or run the command **"Daily Work Log 대시보드 열기"** from the Command Palette. Opens as a normal tab in the main workspace.
- **Sidebar**: run the command **"Daily Work Log 사이드바 열기"** from the Command Palette (`Cmd/Ctrl+P`). You can assign it a hotkey in **Settings → Hotkeys**.
- Click a date on the calendar to open that day's note (a confirmation prompt appears if it doesn't exist yet); click **Today** to jump straight to today's note without a prompt.

## Settings

- **마커 언어 (Marker language)**: which language's heading labels get inserted into newly created notes. Existing notes in either language keep working regardless of this setting.
- **사이드바 테마 (Sidebar theme)**: Light or Dark, for the sidebar only.

## Development

```bash
npm test    # run the Vitest unit test suite
npm run build   # type-check (tsc) + production build
```

See [`.agents/AGENTS.md`](.agents/AGENTS.md) and [`.agents/design.md`](.agents/design.md) for the full architecture and design spec.

## License

MIT
