/**
 * Pure parsing utilities for Daily Work Log notes.
 * ZERO Obsidian API dependency — must stay unit-testable in plain Node/Vitest.
 * See .agents/AGENTS.md section 1 for the full spec these functions implement.
 */

export interface TimelineItem {
	line: number;
	/** Number of physical lines this item occupies, including any absorbed continuation lines (AGENTS.md 1.4.2). Always >= 1. */
	lineCount: number;
	start: string;
	end: string;
	/** Category display name, verbatim as stored in the body (AGENTS.md 1.4.1). `undefined` = uncategorized (legacy line, or user never set one). */
	category?: string;
	description: string;
}

export interface TodoItem {
	line: number;
	/** Number of physical lines this item occupies, including any absorbed continuation lines (AGENTS.md 1.4.2). Always >= 1. */
	lineCount: number;
	checked: boolean;
	text: string;
}

export interface ParsedDailyNote {
	timeline: TimelineItem[];
	todos: TodoItem[];
}

export type BlockType = "timeline" | "todo" | "journal";

export type MarkerLanguage = "en" | "ko";

export interface LineRange {
	/** 0-based, inclusive */
	start: number;
	/** 0-based, inclusive */
	end: number;
}

export interface BlockLayout {
	blocks: Partial<Record<BlockType, LineRange>>;
	/** true when none of the three reserved markers were found (legacy fallback) */
	legacy: boolean;
}

/**
 * Exported so callers (e.g. view.ts) can re-validate a line before mutating it in place.
 * Group 3 (category) is optional — AGENTS.md 1.4.1: `- HH:mm - HH:mm [Category] description`.
 * Lines written before the category feature existed have no `[...]` token at all and still
 * match, with group 3 `undefined` (see parseTimeline / timelineLineMatches).
 */
export const TIME_RANGE_REGEX = /^[-*]\s*(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})\s*(?:\[([^\]]*)\]\s*)?(.*)$/;
/** Exported so callers (e.g. view.ts) can re-validate a line before mutating it in place. */
export const CHECKBOX_REGEX = /^[-*]\s*\[([ xX])\]\s*(.*)$/;
/**
 * Strict "HH:mm" validation for a single user-entered time VALUE (hours
 * 00-23, minutes 00-59) — e.g. TimelineModal's start/end inputs. This is
 * deliberately stricter than TIME_RANGE_REGEX above, which only extracts
 * the shape `\d{1,2}:\d{2}` out of an existing line and doesn't range-check
 * it (that regex's job is finding/parsing lines, not validating new input).
 */
export const TIME_VALUE_REGEX = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;
const FRONTMATTER_DELIMITER = "---";

/**
 * Reserved marker text per block type and display language. Used both to
 * scaffold new notes (dailyNote.ts buildSkeletonContent) and, together with
 * LEGACY_MARKER_LABELS below, to recognize markers when parsing. ALL
 * languages AND both spellings are recognized simultaneously when parsing,
 * regardless of the plugin's configured language setting — that setting only
 * controls which label is inserted into newly scaffolded notes. Changing it
 * must never break parsing of notes already written under a different
 * language or spelling.
 */
export const MARKER_LABELS: Record<BlockType, Record<MarkerLanguage, string>> = {
	timeline: { en: "Event", ko: "이벤트" },
	todo: { en: "ToDo", ko: "할일" },
	journal: { en: "Diary", ko: "다이어리" },
};

/**
 * Pre-2026-08 marker spelling (leading underscore, e.g. `_Event`). Dropped as
 * the scaffolding default because a lone leading `_` renders italic in most
 * markdown viewers. Recognized here ONLY for parsing, so notes written before
 * this change keep working — never used to scaffold new notes (AGENTS.md 1.3).
 */
const LEGACY_MARKER_LABELS: Record<BlockType, Record<MarkerLanguage, string>> = {
	timeline: { en: "_Event", ko: "_이벤트" },
	todo: { en: "_ToDo", ko: "_할일" },
	journal: { en: "_Diary", ko: "_다이어리" },
};

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MARKER_PATTERNS: Array<{ type: BlockType; regex: RegExp }> = (
	Object.keys(MARKER_LABELS) as BlockType[]
).flatMap((type) =>
	[...Object.values(MARKER_LABELS[type]), ...Object.values(LEGACY_MARKER_LABELS[type])].map((label) => ({
		type,
		regex: new RegExp(`^#\\s+${escapeRegExp(label)}$`, "i"),
	}))
);

/**
 * Strips a trailing CRLF `\r` only — NOT a general whitespace trim. A line
 * like `" --- "` (real leading/trailing spaces) must still fail the frontmatter
 * delimiter check per AGENTS.md 1.2 ("exactly `---`"); only the line-ending
 * encoding (CRLF vs LF) is treated as insignificant.
 */
function stripTrailingCarriageReturn(line: string): string {
	return line.endsWith("\r") ? line.slice(0, -1) : line;
}

/**
 * Strips a leading YAML frontmatter block (line 0 must be exactly `---`,
 * closed by the next line that is exactly `---`). Line indices in the
 * returned `lines` array stay relative to the original file — callers get a
 * `bodyStart` offset to scan from instead of a re-numbered array.
 */
export function stripFrontmatter(content: string): { lines: string[]; bodyStart: number } {
	const lines = content.split("\n");

	if (stripTrailingCarriageReturn(lines[0] ?? "") !== FRONTMATTER_DELIMITER) {
		return { lines, bodyStart: 0 };
	}

	for (let i = 1; i < lines.length; i++) {
		if (stripTrailingCarriageReturn(lines[i]) === FRONTMATTER_DELIMITER) {
			return { lines, bodyStart: i + 1 };
		}
	}

	// No closing delimiter found: not a valid frontmatter block, parse from the top.
	return { lines, bodyStart: 0 };
}

function matchMarker(line: string): BlockType | null {
	const trimmed = line.trim();
	for (const { type, regex } of MARKER_PATTERNS) {
		if (regex.test(trimmed)) {
			return type;
		}
	}
	return null;
}

/**
 * True when `line` is a top-level line of EITHER block type, or a block
 * marker — i.e. anything that must never be silently absorbed as a
 * continuation/note line of a preceding Timeline or To-Do item (AGENTS.md
 * 1.4.2). Checking both regexes (not just the caller's own) is required:
 * without it, a stray checkbox line inside the Timeline block (or a
 * time-range line inside the To-Do block — most commonly via the legacy,
 * marker-less fallback where both blocks share one line range) would get
 * silently swallowed into the wrong item's text instead of staying its own
 * item. Exported so `TimelineModal` can reject a description whose
 * continuation lines would misparse on the next read, instead of silently
 * losing them.
 */
export function isTopLevelOrMarker(line: string): boolean {
	return TIME_RANGE_REGEX.test(line) || CHECKBOX_REGEX.test(line) || matchMarker(line) !== null;
}

/**
 * Boundary computation per AGENTS.md 1.3:
 * 1. Record only the first occurrence of each marker label.
 * 2. Sort those (at most 3) positions by line number.
 * 3. Each block spans from its recorded marker to the next recorded
 *    position (or EOF) — duplicate marker lines never participate here,
 *    so they fall through as ordinary content of whichever block they're in.
 */
export function splitBlocksByMarker(lines: string[], bodyStart: number): BlockLayout {
	const firstOccurrence = new Map<BlockType, number>();

	for (let i = bodyStart; i < lines.length; i++) {
		const type = matchMarker(lines[i]);
		if (type && !firstOccurrence.has(type)) {
			firstOccurrence.set(type, i);
		}
	}

	if (firstOccurrence.size === 0) {
		return { blocks: {}, legacy: true };
	}

	const sorted = Array.from(firstOccurrence.entries()).sort((a, b) => a[1] - b[1]);
	const blocks: Partial<Record<BlockType, LineRange>> = {};

	for (let i = 0; i < sorted.length; i++) {
		const [type, markerLine] = sorted[i];
		const nextMarkerLine = i + 1 < sorted.length ? sorted[i + 1][1] : lines.length;
		blocks[type] = { start: markerLine + 1, end: nextMarkerLine - 1 };
	}

	return { blocks, legacy: false };
}

function linesInRange(lines: string[], range: LineRange): { text: string; line: number }[] {
	const start = Math.max(range.start, 0);
	const end = Math.min(range.end, lines.length - 1);
	const result: { text: string; line: number }[] = [];
	for (let i = start; i <= end; i++) {
		result.push({ text: lines[i], line: i });
	}
	return result;
}

/**
 * A line that matches neither block's top-level regex nor a marker (AGENTS.md
 * 1.4.2) is a continuation of the item currently being built — it's absorbed
 * verbatim (raw text, no trim) so the item's stored text round-trips exactly
 * back to the original file on the next save. Two stop conditions end the
 * run and clear `current`, so anything from that point on is orphaned rather
 * than glued onto a now-unrelated (or no-longer-relevant) item:
 * - `isTopLevelOrMarker` (a line belonging to the OTHER block type, or a
 *   marker) — matters most for the legacy (marker-less) fallback, where
 *   Timeline and To-Do items are interleaved in one shared line range.
 * - A SECOND consecutive blank line. One blank line is absorbed as a
 *   meaningful paragraph break; two or more in a row reads as "unrelated
 *   content follows" (most commonly a hand-edited file, since the modal's
 *   own save path already collapses runs of 3+ typed newlines down to one
 *   blank line before it ever reaches the file — see `TimelineModal`). The
 *   orphaned tail is left in the file untouched, never deleted — the point
 *   is only that it stops being treated as part of THIS item, so re-editing
 *   and re-saving the item (range-bounded by `lineCount`) can never
 *   overwrite it.
 */
export function parseTimeline(lines: string[], range: LineRange): TimelineItem[] {
	const items: TimelineItem[] = [];
	let current: TimelineItem | null = null;
	let previousWasBlank = false;
	for (const { text, line } of linesInRange(lines, range)) {
		const match = TIME_RANGE_REGEX.exec(text);
		if (match) {
			current = {
				line,
				lineCount: 1,
				start: match[1],
				end: match[2],
				category: match[3] ? match[3] : undefined,
				description: match[4].trim(),
			};
			items.push(current);
			previousWasBlank = false;
			continue;
		}
		const isBlank = text.trim() === "";
		if (isTopLevelOrMarker(text) || (isBlank && previousWasBlank)) {
			current = null;
			previousWasBlank = false;
			continue;
		}
		if (current) {
			current.description += `\n${text}`;
			current.lineCount++;
		}
		previousWasBlank = isBlank;
	}
	for (const item of items) {
		item.description = item.description.trimEnd();
	}
	return items;
}

export function parseTodo(lines: string[], range: LineRange): TodoItem[] {
	const items: TodoItem[] = [];
	let current: TodoItem | null = null;
	let previousWasBlank = false;
	for (const { text, line } of linesInRange(lines, range)) {
		const match = CHECKBOX_REGEX.exec(text);
		if (match) {
			current = {
				line,
				lineCount: 1,
				checked: match[1].toLowerCase() === "x",
				text: match[2].trim(),
			};
			items.push(current);
			previousWasBlank = false;
			continue;
		}
		const isBlank = text.trim() === "";
		if (isTopLevelOrMarker(text) || (isBlank && previousWasBlank)) {
			current = null;
			previousWasBlank = false;
			continue;
		}
		if (current) {
			current.text += `\n${text}`;
			current.lineCount++;
		}
		previousWasBlank = isBlank;
	}
	for (const item of items) {
		item.text = item.text.trimEnd();
	}
	return items;
}

/**
 * Full pipeline: frontmatter strip -> marker-based block split (or legacy
 * fallback) -> structured Timeline/To-Do extraction. `_Today Journal`
 * content is intentionally not returned here — the parser only needed to
 * recognize its boundary so it doesn't bleed into the other two blocks.
 */
export function parseDailyNote(content: string): ParsedDailyNote {
	const { lines, bodyStart } = stripFrontmatter(content);
	const layout = splitBlocksByMarker(lines, bodyStart);

	if (layout.legacy) {
		const wholeBody: LineRange = { start: bodyStart, end: lines.length - 1 };
		return {
			timeline: parseTimeline(lines, wholeBody),
			todos: parseTodo(lines, wholeBody),
		};
	}

	return {
		timeline: layout.blocks.timeline ? parseTimeline(lines, layout.blocks.timeline) : [],
		todos: layout.blocks.todo ? parseTodo(lines, layout.blocks.todo) : [],
	};
}

/**
 * Re-validates that `line` still represents the exact same rendered To-Do
 * item (same checked state AND same text) before a caller mutates it in
 * place. The file may have changed between render and the user's click
 * (AGENTS.md 1.5) — this is the shared check used by toggle/delete.
 */
export function todoLineMatches(line: string, item: TodoItem): boolean {
	const match = CHECKBOX_REGEX.exec(line);
	return match !== null && (match[1].toLowerCase() === "x") === item.checked && match[2].trim() === item.text;
}

/** Same staleness guard as `todoLineMatches`, for Timeline/Event items. */
export function timelineLineMatches(line: string, item: TimelineItem): boolean {
	const match = TIME_RANGE_REGEX.exec(line);
	if (match === null) return false;
	const category = match[3] ? match[3] : undefined;
	return (
		match[1] === item.start &&
		match[2] === item.end &&
		category === item.category &&
		match[4].trim() === item.description
	);
}

/**
 * Range-aware staleness guard (AGENTS.md 1.4.2): re-parses exactly the
 * item's own `[line, line + lineCount - 1]` span in isolation and checks it
 * still reproduces the same item, including any absorbed continuation
 * lines. Re-running `parseTimeline`/`parseTodo` on that narrow span (rather
 * than hand-rolling a second comparison) guarantees this guard can never
 * drift out of sync with what a real reload would parse.
 */
export function timelineRangeMatches(lines: string[], item: TimelineItem): boolean {
	const reparsed = parseTimeline(lines, { start: item.line, end: item.line + item.lineCount - 1 });
	if (reparsed.length !== 1) return false;
	const candidate = reparsed[0];
	return (
		candidate.line === item.line &&
		candidate.lineCount === item.lineCount &&
		candidate.start === item.start &&
		candidate.end === item.end &&
		candidate.category === item.category &&
		candidate.description === item.description
	);
}

/** Same as `timelineRangeMatches`, for To-Do items. */
export function todoRangeMatches(lines: string[], item: TodoItem): boolean {
	const reparsed = parseTodo(lines, { start: item.line, end: item.line + item.lineCount - 1 });
	if (reparsed.length !== 1) return false;
	const candidate = reparsed[0];
	return (
		candidate.line === item.line &&
		candidate.lineCount === item.lineCount &&
		candidate.checked === item.checked &&
		candidate.text === item.text
	);
}

/** Replaces the lines `[lineIndex, lineIndex + lineCount - 1]` with `replacement` (split on `\n`) and returns the new full content. */
export function replaceLineRangeAt(content: string, lineIndex: number, lineCount: number, replacement: string): string {
	const lines = content.split("\n");
	lines.splice(lineIndex, lineCount, ...replacement.split("\n"));
	return lines.join("\n");
}

/** Removes the lines `[lineIndex, lineIndex + lineCount - 1]` and returns the new full content. */
export function removeLineRangeAt(content: string, lineIndex: number, lineCount: number): string {
	const lines = content.split("\n");
	lines.splice(lineIndex, lineCount);
	return lines.join("\n");
}

/** Replaces a single line (by original index) and returns the new full content. */
export function replaceLineAt(content: string, lineIndex: number, newLine: string): string {
	return replaceLineRangeAt(content, lineIndex, 1, newLine);
}

/** Removes a single line (by original index) and returns the new full content. */
export function removeLineAt(content: string, lineIndex: number): string {
	return removeLineRangeAt(content, lineIndex, 1);
}

/**
 * Appends `newLine` to the end of the given block's content (or to the end
 * of the whole file if that block/marker isn't present — e.g. a legacy file,
 * or one missing that particular marker). Used for inline To-Do/Event
 * creation. Frontmatter and other blocks are left untouched; the new line
 * always lands just before the next block's marker (or EOF).
 */
export function appendLineToBlock(content: string, blockType: BlockType, newLine: string): string {
	const { lines, bodyStart } = stripFrontmatter(content);
	const layout = splitBlocksByMarker(lines, bodyStart);
	const range = layout.legacy ? undefined : layout.blocks[blockType];

	if (!range) {
		return appendAtEndOfFile(lines, newLine);
	}

	const insertAt = range.end + 1;
	if (insertAt >= lines.length) {
		return appendAtEndOfFile(lines, newLine);
	}

	return [...lines.slice(0, insertAt), newLine, ...lines.slice(insertAt)].join("\n");
}

/**
 * Appends at the very end of the file. `content.split("\n")` leaves a
 * trailing `""` element whenever the original content ended in a newline
 * (which is the common case for files saved through a normal editor) —
 * naively appending after that element would turn one trailing newline
 * into two blank lines, and repeated appends would keep compounding it.
 * Insert BEFORE that trailing empty artifact instead, so the file still
 * ends with exactly one trailing newline.
 */
function appendAtEndOfFile(lines: string[], newLine: string): string {
	if (lines.length > 0 && lines[lines.length - 1] === "") {
		return [...lines.slice(0, -1), newLine, ""].join("\n");
	}
	return [...lines, newLine].join("\n");
}

const MINUTES_PER_DAY = 24 * 60;

/** Parses "HH:mm" into minutes-since-midnight. */
export function timeToMinutes(hhmm: string): number {
	const [hours, minutes] = hhmm.split(":").map(Number);
	return hours * 60 + minutes;
}

/** Inverse of `timeToMinutes` — formats minutes-since-midnight as zero-padded "HH:mm". Used by the grid's drag-to-select. */
export function minutesToTime(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Duration of a Timeline/Event item in minutes. If `end` is not after
 * `start`, the range is treated as crossing midnight (e.g. 23:00-01:00).
 * Shared by the Timeline component (bar height) and the Dashboard's
 * "total recorded time" aggregate so the two never drift apart.
 */
export function timelineDurationMinutes(item: Pick<TimelineItem, "start" | "end">): number {
	const startMinutes = timeToMinutes(item.start);
	const endMinutes = timeToMinutes(item.end);
	return Math.max(endMinutes - startMinutes + (endMinutes <= startMinutes ? MINUTES_PER_DAY : 0), 0);
}

const HTML_ENTITIES: Record<string, string> = {
	"&nbsp;": " ",
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
};

/**
 * Strips HTML tags (e.g. from notes edited with a rich-text/formatting
 * plugin like Obsidian's Editing Toolbar) for **display purposes only** —
 * callers must never write the stripped result back to the note file, only
 * use it where raw note text is rendered in the sidebar/export UI. The
 * source of truth in the file keeps its original HTML untouched.
 */
export function stripHtml(text: string): string {
	return text.replace(/<[^>]*>/g, "").replace(/&[a-zA-Z]+;|&#\d+;/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}
