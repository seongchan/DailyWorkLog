/**
 * Daily note filename <-> Date helpers and the new-note skeleton template.
 * Kept separate from parser.ts (which only parses existing content) since
 * this module is about note creation, not parsing.
 */

/**
 * Imported directly from the `moment` package, not `import { moment } from
 * "obsidian"` — the `obsidian` package ships types only (no runtime JS), so
 * that form can't resolve outside a real Obsidian window and would break
 * this module's Vitest tests (AGENTS.md §4's "zero Obsidian API dependency,
 * pure functions" rule). Unlike "obsidian"/"electron", `moment` is
 * deliberately NOT marked `external` in esbuild.config.mjs — Obsidian's
 * plugin sandbox doesn't special-case a bare `require("moment")`, so leaving
 * it external makes the built main.js fail that require at load time and the
 * whole plugin silently fails to load (see esbuild.config.mjs's comment on
 * the `external` list for the full explanation). esbuild bundles the real
 * `moment` package into main.js instead, so it's self-contained.
 */
import moment from "moment";
import { MARKER_LABELS, type MarkerLanguage } from "./parser";

/**
 * Moment.js format token string. Matches the core "Daily notes" plugin's own
 * `format` setting shape, including its dynamic-folder trick: a `/` in the
 * format produces nested subfolders under `dailyNoteFolder` (e.g.
 * `YYYY/MM/YYYY-MM-DD` -> `2026/09/2026-09-01.md`). This default preserves
 * the plugin's original fixed-shape behavior exactly.
 */
export const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";

/** Always the fixed ISO shape — used for on-screen date labels (headers, dashboard rows), never for file lookup/creation. Kept independent of the configurable `dateFormat` setting so a nested/unusual format never leaks into the UI as a raw folder path. */
export function formatDateBasename(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/**
 * Parses a daily note's basename (or, for a nested `format`, its full path
 * relative to `dailyNoteFolder` with the `.md` extension already stripped —
 * see `parseDateFromNotePath`) against `format`. Strict moment parsing
 * rejects both shape mismatches (un-padded numbers, wrong separators) and
 * calendar overflow (`2026-02-31`, `2026-13-01`) in one step.
 */
export function parseDateFromBasename(source: string, format: string = DEFAULT_DATE_FORMAT): Date | null {
	const parsed = moment(source, format, true);
	return parsed.isValid() ? parsed.toDate() : null;
}

export function isSameDate(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * New notes are scaffolded with the three reserved markers already in
 * place (AGENTS.md 2. New Daily Note Creation) to minimize hand-typing
 * typo risk for future edits. `language` only picks which label text gets
 * inserted here — the parser recognizes every supported language's labels
 * (and the legacy underscore-prefixed spelling, AGENTS.md 1.3) regardless
 * of this setting, so switching languages later never breaks notes already
 * scaffolded under a different one. `MARKER_LABELS` holds the current
 * (no-underscore) spelling only — this never scaffolds the legacy form.
 */
export function buildSkeletonContent(language: MarkerLanguage): string {
	return [
		`# ${MARKER_LABELS.timeline[language]}`,
		"",
		`# ${MARKER_LABELS.todo[language]}`,
		"",
		`# ${MARKER_LABELS.journal[language]}`,
		"",
	].join("\n");
}

/**
 * Checks whether a vault-relative file path is located inside the configured
 * `dailyNoteFolder`. An empty or whitespace-only folder setting allows files
 * anywhere in the vault.
 */
export function isInDailyNoteFolder(filePath: string, dailyNoteFolder: string): boolean {
	const folder = dailyNoteFolder.trim().replace(/^\/+|\/+$/g, "");
	if (!folder) return true;
	return filePath === folder || filePath.startsWith(`${folder}/`);
}

/**
 * Strips `dailyNoteFolder` and the `.md` extension from a vault-relative
 * file path, leaving exactly the portion `format` is expected to describe —
 * including any `/`-nested segments a dynamic-folder format produces (e.g.
 * `Daily Notes/2026/09/2026-09-01.md` + folder `Daily Notes` -> `2026/09/2026-09-01`).
 * Returns `null` for a non-.md file or one outside the configured folder.
 */
export function getNoteRelativePath(filePath: string, dailyNoteFolder: string): string | null {
	if (!filePath.endsWith(".md")) return null;
	if (!isInDailyNoteFolder(filePath, dailyNoteFolder)) return null;

	const withoutExt = filePath.slice(0, -".md".length);
	const folder = dailyNoteFolder.trim().replace(/^\/+|\/+$/g, "");
	return folder ? withoutExt.slice(folder.length + 1) : withoutExt;
}

/**
 * Folder-and-format-aware counterpart to `parseDateFromBasename` — the one
 * every Obsidian-facing call site should use, since it's the only variant
 * that correctly handles a `format` containing `/` (dynamic year/month
 * subfolders). Returns `null` for any file outside `dailyNoteFolder` or
 * whose path doesn't match `format`.
 */
export function parseDateFromNotePath(filePath: string, dailyNoteFolder: string, format: string = DEFAULT_DATE_FORMAT): Date | null {
	const relative = getNoteRelativePath(filePath, dailyNoteFolder);
	return relative === null ? null : parseDateFromBasename(relative, format);
}

/**
 * Inverse of `parseDateFromNotePath` — the vault-relative path a daily note
 * for `date` should live at. A `format` containing `/` naturally produces
 * intermediate folder segments (e.g. `YYYY/MM/YYYY-MM-DD` under folder
 * `Daily Notes` -> `Daily Notes/2026/09/2026-09-01.md`); the caller is
 * responsible for creating those folders before writing the file (they
 * aren't created implicitly by this pure formatting step).
 */
export function formatNoteFilePath(date: Date, dailyNoteFolder: string, format: string = DEFAULT_DATE_FORMAT): string {
	const relative = moment(date).format(format);
	const folder = dailyNoteFolder.trim().replace(/^\/+|\/+$/g, "");
	return `${folder ? `${folder}/` : ""}${relative}.md`;
}

