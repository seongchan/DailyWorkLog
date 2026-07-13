/**
 * Pure statistics computation for the Dashboard view.
 * ZERO Obsidian API dependency — same "decoupled parser strategy" as
 * parser.ts/dailyNote.ts (AGENTS.md 4), so this stays unit-testable in
 * plain Node/Vitest. The Obsidian-dependent side (scanning the vault,
 * reading file contents) lives in DashboardView.ts, which calls into this
 * module with already-extracted data.
 */

import { formatDateBasename } from "./dailyNote";
import { timelineDurationMinutes, type ParsedDailyNote } from "./parser";

/** How far back "recent" stats (To-Do completion, total Event time) look. */
export const RECENT_WINDOW_DAYS = 30;

export interface DashboardStats {
	totalNotes: number;
	oldestDate: Date | null;
	newestDate: Date | null;
	/** Consecutive days with a note, counting backward from `today` (0 if today has none). */
	currentStreak: number;
	recentTodoTotal: number;
	recentTodoCompleted: number;
	recentEventMinutes: number;
}

/**
 * First calendar day of the "recent" window (inclusive), for a given
 * `today`. Callers use this to decide which daily notes' *content* is
 * actually worth reading — deliberately bounded so scanning a vault with
 * years of history doesn't mean reading years of file content just to
 * render the dashboard (task.md "성능 고려 범위 제한").
 */
export function getRecentWindowStart(today: Date): Date {
	const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	start.setDate(start.getDate() - (RECENT_WINDOW_DAYS - 1));
	return start;
}

/**
 * @param allNoteDates every daily note's date, filename-derived only (cheap — no file reads needed).
 * @param recentParsed only the notes within the last `RECENT_WINDOW_DAYS`, with content already read+parsed.
 * @param today "now", passed in explicitly so this stays a pure, testable function.
 */
export function computeDashboardStats(
	allNoteDates: Date[],
	recentParsed: Array<{ date: Date; parsed: ParsedDailyNote }>,
	today: Date
): DashboardStats {
	if (allNoteDates.length === 0) {
		return {
			totalNotes: 0,
			oldestDate: null,
			newestDate: null,
			currentStreak: 0,
			recentTodoTotal: 0,
			recentTodoCompleted: 0,
			recentEventMinutes: 0,
		};
	}

	const sorted = [...allNoteDates].sort((a, b) => a.getTime() - b.getTime());
	const oldestDate = sorted[0];
	const newestDate = sorted[sorted.length - 1];

	const noteDateStrings = new Set(allNoteDates.map((date) => formatDateBasename(date)));
	let currentStreak = 0;
	const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	while (noteDateStrings.has(formatDateBasename(cursor))) {
		currentStreak++;
		cursor.setDate(cursor.getDate() - 1);
	}

	let recentTodoTotal = 0;
	let recentTodoCompleted = 0;
	let recentEventMinutes = 0;
	for (const { parsed } of recentParsed) {
		recentTodoTotal += parsed.todos.length;
		recentTodoCompleted += parsed.todos.filter((item) => item.checked).length;
		for (const item of parsed.timeline) {
			recentEventMinutes += timelineDurationMinutes(item);
		}
	}

	return {
		totalNotes: allNoteDates.length,
		oldestDate,
		newestDate,
		currentStreak,
		recentTodoTotal,
		recentTodoCompleted,
		recentEventMinutes,
	};
}
