# Project Rules & Instructions for AI Agents

Welcome, AI Agent! You are working on the **Daily Work Log** Obsidian Plugin. This project aims to build an Obsidian plugin that visualizes daily time tracking and To-Do lists directly from daily markdown files.

Please strictly adhere to the following rules and specifications during development.

---

## 1. Core Architectural Constraints & File Parsing

### 1.1 Document Format (Minimal Metadata)
- Daily note files MUST follow the naming convention of `YYYY-MM-DD.md`.
- **CRITICAL**: Do NOT enforce or auto-generate YAML Frontmatter unless explicitly configured or requested. Minimizing metadata bloat is a core design philosophy — a prior project (DayTime Tracker) pushed most content into YAML frontmatter, making the raw markdown unreadable without the plugin. This project intentionally keeps all visual information in the markdown body instead.
- A file MAY still legitimately contain a YAML frontmatter block (added manually by the user or by another plugin). The parser MUST NOT misinterpret it as a content block marker — see **1.2 Frontmatter Handling** below.
- **Basename → Date parsing must round-trip, not just regex-match.** `src/dailyNote.ts` `parseDateFromBasename` first checks the `YYYY-MM-DD` shape with a regex, then constructs a `Date` and re-reads its year/month/day back out to confirm they match the input exactly. This is required because `new Date(year, month, day)` silently rolls invalid values over into a neighboring date instead of erroring (e.g. `2026-02-31` becomes `2026-03-03`) — without the round-trip check, a malformed filename would be treated as some other, unrelated valid date instead of being rejected as "not a daily note".

### 1.2 Frontmatter Handling (MUST run before block-marker detection)
- If line index `0` of the file is exactly `---`, treat everything from line `0` up to and including the next line that is exactly `---` as a YAML frontmatter block and skip it before searching for block markers.
- If no closing `---` is found, do not treat it as frontmatter (fall through to normal parsing).
- **"Exactly `---`" means exactly** — do NOT `.trim()` the line before comparing (a real body line like `" --- "` with actual leading/trailing spaces must NOT be mistaken for a frontmatter delimiter). The only normalization allowed is stripping a trailing `\r` so CRLF-terminated files aren't broken — that's a line-ending encoding detail, not a content difference. This is deliberately stricter than the block-marker matching in 1.3, which DOES trim (hand-typed H1 headings are expected to have stray whitespace; a frontmatter fence is not).
- This stripping logic MUST be implemented as a pure function inside `src/parser.ts` (no Obsidian API dependency), consistent with the Decoupled Parser Strategy in Section 4.
- **Line indices must stay relative to the original file.** Do not renumber lines after stripping — downstream To-Do line-index tracking (1.5) depends on original file line numbers.

### 1.3 Block Markers (Reserved Headings, Multi-Language)
Content blocks are identified by three reserved **H1** headings, not by a generic `---` divider (a `---` divider was rejected because it collides with YAML frontmatter's closing delimiter):

- Timeline block: `# _Event` (English) / `# _이벤트` (Korean)
- To-Do block: `# _ToDo` (English) / `# _할일` (Korean)
- Journal block: `# _Diary` (English) / `# _다이어리` (Korean)

**Multi-language recognition is unconditional**: the parser recognizes marker labels in **every** supported language **simultaneously**, regardless of the plugin's configured display language (see 2. Settings). The language setting ONLY controls which label text gets inserted when the plugin scaffolds a *new* note — it never changes what the parser accepts when reading. This is deliberate: switching the language setting must never break parsing of notes already written under a different language (e.g. a vault synced across devices with different settings, or a user who simply changes their mind later).

Rules:
- Heading level is fixed at H1 (`#`). Matching is by exact text, not by heading depth, so any other H1 the user writes for their own purposes will never collide (the leading `_` is intentionally unusual in normal prose/titles).
- Matching MUST be tolerant of accidental hand-typing: trim surrounding whitespace and match case-insensitively (e.g. `# _todo` still matches). This is a second line of defense — the first line of defense is that the plugin auto-inserts these headings with correct casing when it creates a new daily note (see 3. Obsidian API Best Practices).
- **Boundary computation (must be implemented in this exact order):**
  1. Scan the file top to bottom and record the line number of the **first** occurrence of each of the three reserved block *types* only (at most one recorded position per type — once a type has a recorded position, ANY further marker line of that type, in ANY supported language, is ignored for boundary purposes; see the duplicate rule below).
  2. Sort the recorded positions by line number. This sorted list — not raw marker occurrences — is the sole source of block boundaries.
  3. Each block's content spans from its recorded position to the next position in the sorted list, or to end-of-file for the last one.
- Blocks are **order-independent** as a result of step 2 — the three block types may appear in any order in the file, and a file may even mix languages (e.g. `# _Event` and `# _할일` in the same note) without issue.
- Any marker line that is NOT the first occurrence of its block *type* (a duplicate — including a same-type marker written in a different supported language) is excluded from the sorted list entirely: it acts neither as a boundary nor as a new start. It simply falls through as ordinary content of whichever block it's physically inside.

### 1.4 Timeline Block (`_Event` / `_이벤트`)
- Lines representing time ranges are formatted as: `- HH:mm - HH:mm [description]` (e.g., `- 09:00 - 10:30 Coding session`).
- Use regex pattern: `/^[-*]\s*(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})\s*(.*)/` to extract. This allows for optional single-digit hours (e.g. `9:00`) and flexible separators (`-` or `~`).
- **`TIME_RANGE_REGEX` (above) is for parsing existing lines — it is NOT a validator.** It only checks the shape `\d{1,2}:\d{2}` and happily matches `99:99`. Anywhere the user TYPES a new time value (e.g. `EventEntryModal`'s start/end inputs), validate with the separate, stricter `TIME_VALUE_REGEX` (also in `parser.ts`), which range-checks hours 00-23 and minutes 00-59. Do not reuse `TIME_RANGE_REGEX` for input validation, and do not loosen `TIME_VALUE_REGEX` back to a shape-only check.

### 1.5 To-Do Block (`_ToDo` / `_할일`)
- Bullet items with checkboxes (`- [ ]` or `- [x]`) are treated as tasks.
- **IMPORTANT (Line Index Tracking)**: The parser MUST track the 0-based line index (relative to the original, unstripped file) for each parsed timeline and To-Do item. This is critical for modifying tasks in-place without causing text replacement collisions (e.g., if there are duplicate tasks).
- **A stored line index is only a hint, not a guarantee.** The sidebar renders To-Do items from a snapshot; the underlying file can change (user edits directly, lines shift) before the user clicks a checkbox. Before writing a toggle, the caller MUST re-read the file and re-validate that `lines[item.line]` is still a checkbox line with the SAME checked state AND the SAME text as the rendered item (see `CHECKBOX_REGEX`, exported from `parser.ts` for this exact purpose). If it doesn't match, abort the write and refresh instead of mutating whatever now happens to occupy that line.
- **`appendLineToBlock` (parser.ts) must not turn a file's trailing newline into an extra blank line.** `content.split("\n")` leaves a trailing `""` element whenever the file already ends in `\n` (the normal case for editor-saved files). Naively inserting after that element compounds one extra blank line per append. The helper detects this trailing empty artifact and inserts BEFORE it instead, so the file keeps exactly one trailing newline no matter how many times a line is appended. Any future rewrite of this function must preserve that behavior — see the `appendLineToBlock` tests in `parser.test.ts` for the exact repeated-append regression case.

### 1.6 Journal Block (`_Diary` / `_다이어리`)
- Free-form notes/memo. The parser only needs to recognize the block **boundary** (its start marker, and where it ends per 1.3) so that Timeline/To-Do parsing does not bleed into it.
- Content inside this block is NOT structurally parsed and is NOT rendered in the sidebar UI. It remains visible only in Obsidian's default markdown editor pane.

### 1.7 Legacy Files (No Markers Found)
- If none of the three reserved markers (1.3) are found anywhere in the file, fall back to the original heuristic: treat every bullet checkbox as a To-Do item, and every line matching the time-range regex (1.4) as a Timeline item, regardless of position in the file.
- **Do NOT auto-migrate legacy files** by inserting marker headings into them. Legacy files are only ever read via this fallback path and are left untouched unless the user manually edits them.

---

## 2. Settings & Localization

- Plugin settings are persisted via Obsidian's standard `loadData()` / `saveData()` pattern (`src/settings.ts` defines `DailyWorkLogSettings` and `DEFAULT_SETTINGS`; `main.ts` merges loaded data over the defaults on `onload`).
- `language: "en" | "ko"`, exposed through a `PluginSettingTab` (`src/SettingTab.ts`) as a dropdown (labels are just "영어"/"한국어" — keep it simple, do not repeat the marker names in the dropdown label). Default is `"en"`.
- **This setting affects note *creation* only** — it selects which label text (`_Event`/`_ToDo`/`_Diary` vs `_이벤트`/`_할일`/`_다이어리`) gets written into the skeleton of a newly scaffolded note (`dailyNote.ts` → `buildSkeletonContent(language)`). It has NO effect on parsing: per 1.3, the parser always recognizes marker labels in every supported language regardless of this setting. Do not add a "strict/current-language-only" parsing mode — this was a deliberate decision to keep changing the setting non-destructive to existing notes.
- Adding a new supported language means: add its labels to `MARKER_LABELS` in `parser.ts` (parsing side) and add a matching dropdown option in `SettingTab.ts` (creation side). Both sides must be updated together.
- `theme: "light" | "dark"` (`SidebarTheme` in `settings.ts`), also a `SettingTab.ts` dropdown ("라이트"/"다크"). Default `"light"`. **This ONLY affects the sidebar view** (`view.ts` toggles a `dwl-theme-light`/`dwl-theme-dark` class on the view root; `styles.css` defines the `--dwl-*` color tokens per class). It is deliberately decoupled from both Obsidian's own active theme AND from modals (modals always follow the SYSTEM theme, Canvas/CanvasText — see 3. Obsidian API Best Practices) and from the Dashboard view (which just follows Obsidian's own theme variables, no manual override). Do not conflate these three theme concerns.

---

## 3. Obsidian API Best Practices

- **Avoid Raw Node `fs` API**: Always use Obsidian's Vault and Workspace APIs (`this.app.vault.read()`, `this.app.vault.modify()`, `this.app.workspace.getActiveFile()`) to modify and read note contents. Using node's native filesystem library bypasses Obsidian's sync mechanisms and may corrupt indices.
- **Event Listeners**:
  - Listen to `layout-change` or `active-leaf-change` on `this.app.workspace` to update the view state dynamically when the user switches documents.
  - Listen to `modify` events on `this.app.vault` to sync edits made in the editor panel to the sidebar UI.
  - **Guard against self-triggered updates**: when the plugin itself writes a change (e.g. To-Do checkbox toggle), the resulting `modify` event must not cause a redundant/looping re-render. Track the last write the plugin performed (e.g. file path + content hash, or a short-lived flag) and skip reprocessing a `modify` event that matches it.
  - **Don't let the tracked "current file" go stale on `active-leaf-change`**: if there IS an active file and it's not a daily note, clear the tracked current file (otherwise the sidebar keeps showing — and can keep writing to — a note that's no longer on screen). If there is NO active file at all (e.g. the sidebar itself has focus), leave the tracked file as-is rather than blanking the view on every leaf switch.
  - **`refresh()` MUST guard against overlapping calls.** It does a synchronous `container.empty()` before an `await vault.read()`; if two triggers (e.g. `active-leaf-change` and `modify` firing close together) call `refresh()` around the same time, a later call's `empty()` can wipe an earlier call's calendar mid-flight, and then BOTH calls' post-`await` continuations append their own Event/To-Do sections into the same container — producing visibly duplicated sections. Use an incrementing token: capture it at the top of `refresh()`, and after the `await`, bail out without rendering if a newer call has since incremented it (`view.ts`'s `refreshToken`).
  - **`refresh()` MUST reuse the same `Calendar` instance, not construct a new one every call.** `Calendar` keeps its viewed month/year as internal state so prev/next navigation works; `view.ts` used to call `new Calendar(...)` on every `refresh()`, which silently reset that state back to "today"/"selected file's month" on every unrelated re-render (a todo toggle, an editor edit elsewhere, etc.) — the user's manual month browsing kept getting thrown away. Instead: create the `Calendar` once (first `refresh()`/`onOpen()`), keep it as a field, and call its `update(language, selectedDate)` method afterward. `update()` only jumps the viewed month when `selectedDate` itself actually changed (a genuinely different file was opened) — a plain re-render must never touch `viewedYear`/`viewedMonth`.
- **CSS Variable Usage**: Use Obsidian's CSS custom properties (variables) like `--text-normal`, `--background-secondary`, `--interactive-accent`, etc. This ensures the plugin respects the user's active theme (light/dark mode) seamlessly.
- **New Daily Note Creation & Confirmation Policy**:
  - New notes are always scaffolded with the three reserved marker headings already in place (in the label language selected in Settings — see 2. Settings & Localization — each followed by an empty line), to minimize hand-typing/typo risk for future edits.
  - Clicking an arbitrary (past/future) date in the Calendar grid that has no file yet: show a confirmation dialog before creating the file.
  - Clicking the dedicated **"오늘 (Today)"** button: skip the confirmation dialog — create (if missing) and open immediately. This is treated as the primary, low-risk, expected action and should not be interrupted.

---

## 4. Development Workflow & Testing Guidelines

- **Decoupled Parser Strategy**: `src/parser.ts` MUST be implemented as a pure TypeScript utility with ZERO dependencies on the Obsidian API. This allows developers to run high-speed unit tests on parsing logic in a pure Node/Vitest environment.
- **Build Pipeline**: The build script utilizes `esbuild` to bundle code. Always compile changes using the configured scripts (e.g., `npm run dev` or `npm run build`).
- **Safety First**: Do not overwrite or modify existing user data structure without validating the parser behavior first. Unit tests in `src/parser.ts` are a prerequisite before making modifications to parsing logic.
- **Required parser test coverage** (in addition to existing regex/line-index cases):
  - Files with a leading YAML frontmatter block (frontmatter must be stripped, not mistaken for a marker).
  - Files with all three markers present, in various orders.
  - Files with markers missing entirely (legacy fallback path).
  - Files with a duplicate marker line (first occurrence wins), including a duplicate expressed in a *different supported language* than the first occurrence.
  - Files that mix marker languages (e.g. one block in English, another in Korean) — must parse identically to an all-one-language file.
- **Required `dailyNote.ts` test coverage** (`src/dailyNote.test.ts`, same pure/no-Obsidian-dependency reasoning as parser.ts):
  - Valid `YYYY-MM-DD` basenames parse and round-trip through `formatDateBasename`.
  - Non-matching basenames (wrong shape, un-padded numbers) return `null`.
  - Calendar-invalid dates (`2026-02-31`, `2026-13-01`, Feb 29 on a non-leap year) return `null` instead of a silently rolled-over `Date`.

---

## 5. Reference Assets

- `docs/sidebar-mockup.html`: a static HTML mockup used purely as a visual reference for the sidebar UI/UX (layout, spacing, calendar/timeline/To-Do look and feel) during development. It is NOT part of the plugin bundle, is not loaded by Obsidian, and is not executable project code — treat it as a design reference only, not as authoritative behavior. `ref_docs/` (implementation history, task checklist) is intentionally untracked/local-only — do not document its contents here.

---

## 5. UI Design Reference

When implementing or modifying **any UI component** (sidebar view, modals, CSS, components), you MUST read [`.agents/design.md`](./design.md) first.

It defines:
- Design principles (pastel color palette, desaturated buttons, minimal delete button)
- Component layouts (To-Do section, Timeline modal, Confirmation popup)
- CSS class naming conventions (`dwl-*`)
- Color system and button specs
- File write safety checklist for new write operations
