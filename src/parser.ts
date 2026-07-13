/**
 * Pure parsing utilities for Daily Work Log notes.
 * ZERO Obsidian API dependency — must stay unit-testable in plain Node/Vitest.
 * See .agents/AGENTS.md section 1 for the full spec these functions implement.
 */

export interface TimelineItem {
	line: number;
	start: string;
	end: string;
	description: string;
}

export interface TodoItem {
	line: number;
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

/** Exported so callers (e.g. view.ts) can re-validate a line before mutating it in place. */
export const TIME_RANGE_REGEX = /^[-*]\s*(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})\s*(.*)$/;
/** Exported so callers (e.g. view.ts) can re-validate a line before mutating it in place. */
export const CHECKBOX_REGEX = /^[-*]\s*\[([ xX])\]\s*(.*)$/;
/**
 * Strict "HH:mm" validation for a single user-entered time VALUE (hours
 * 00-23, minutes 00-59) — e.g. EventEntryModal's start/end inputs. This is
 * deliberately stricter than TIME_RANGE_REGEX above, which only extracts
 * the shape `\d{1,2}:\d{2}` out of an existing line and doesn't range-check
 * it (that regex's job is finding/parsing lines, not validating new input).
 */
export const TIME_VALUE_REGEX = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;
const FRONTMATTER_DELIMITER = "---";

/**
 * Reserved marker text per block type and display language. ALL languages
 * are recognized simultaneously when parsing, regardless of the plugin's
 * configured language setting — that setting only controls which label is
 * inserted into newly scaffolded notes (see dailyNote.ts). Changing it must
 * never break parsing of notes already written under a different language.
 */
export const MARKER_LABELS: Record<BlockType, Record<MarkerLanguage, string>> = {
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
	Object.values(MARKER_LABELS[type]).map((label) => ({
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

export function parseTimeline(lines: string[], range: LineRange): TimelineItem[] {
	const items: TimelineItem[] = [];
	for (const { text, line } of linesInRange(lines, range)) {
		const match = TIME_RANGE_REGEX.exec(text);
		if (match) {
			items.push({
				line,
				start: match[1],
				end: match[2],
				description: match[3].trim(),
			});
		}
	}
	return items;
}

export function parseTodo(lines: string[], range: LineRange): TodoItem[] {
	const items: TodoItem[] = [];
	for (const { text, line } of linesInRange(lines, range)) {
		const match = CHECKBOX_REGEX.exec(text);
		if (match) {
			items.push({
				line,
				checked: match[1].toLowerCase() === "x",
				text: match[2].trim(),
			});
		}
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
	return (
		match !== null &&
		match[1] === item.start &&
		match[2] === item.end &&
		match[3].trim() === item.description
	);
}

/** Replaces a single line (by original index) and returns the new full content. */
export function replaceLineAt(content: string, lineIndex: number, newLine: string): string {
	const lines = content.split("\n");
	lines[lineIndex] = newLine;
	return lines.join("\n");
}

/** Removes a single line (by original index) and returns the new full content. */
export function removeLineAt(content: string, lineIndex: number): string {
	const lines = content.split("\n");
	lines.splice(lineIndex, 1);
	return lines.join("\n");
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
