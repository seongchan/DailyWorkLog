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
import { DEFAULT_CATEGORIES, type CustomCategory } from "./settings";

/** How far back "recent" stats (To-Do completion, total Event time) look. */
export const RECENT_WINDOW_DAYS = 30;

export interface CategoryStatItem {
	displayName: string;
	color: string;
	minutes: number;
	percentage: number;
}

export interface NoteActivitySummary {
	date: Date;
	todoTotal: number;
	todoCompleted: number;
	eventMinutes: number;
	topCategory: string | null;
}

export interface DashboardStats {
	totalNotes: number;
	oldestDate: Date | null;
	newestDate: Date | null;
	/** Consecutive days with a note, counting backward from `today` (0 if today has none). */
	currentStreak: number;
	recentTodoTotal: number;
	recentTodoCompleted: number;
	recentEventMinutes: number;
	avgEventMinutesPerDay: number;
	topCategoryName: string | null;
	categoryBreakdown: CategoryStatItem[];
	recentNotesSummary: NoteActivitySummary[];
}

/**
 * First calendar day of the "recent" window (inclusive), for a given
 * `today` and `windowDays` (defaults to RECENT_WINDOW_DAYS).
 */
export function getRecentWindowStart(today: Date, windowDays: number = RECENT_WINDOW_DAYS): Date {
	const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	if (windowDays > 0) {
		start.setDate(start.getDate() - (windowDays - 1));
	} else {
		// All time: set start date far in the past (e.g. 1970-01-01)
		start.setFullYear(1970, 0, 1);
	}
	return start;
}

/**
 * @param allNoteDates every daily note's date, filename-derived only (cheap — no file reads needed).
 * @param recentParsed notes within the selected window, with content already read+parsed.
 * @param today "now", passed in explicitly so this stays a pure, testable function.
 * @param categories configured categories for color/label matching.
 * @param uncategorizedLabel localized label for uncategorized items.
 */
export function computeDashboardStats(
	allNoteDates: Date[],
	recentParsed: Array<{ date: Date; parsed: ParsedDailyNote }>,
	today: Date,
	categories: CustomCategory[] = DEFAULT_CATEGORIES,
	uncategorizedLabel = "Uncategorized"
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
			avgEventMinutesPerDay: 0,
			topCategoryName: null,
			categoryBreakdown: [],
			recentNotesSummary: [],
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

	// Map of category displayName -> total minutes
	const categoryMinutesMap = new Map<string, number>();
	for (const cat of categories) {
		categoryMinutesMap.set(cat.displayName, 0);
	}

	let uncategorizedMinutes = 0;
	const recentNotesSummary: NoteActivitySummary[] = [];

	// Sort recentParsed newest-first for activity list summary
	const sortedRecentParsed = [...recentParsed].sort((a, b) => b.date.getTime() - a.date.getTime());

	for (const { date, parsed } of sortedRecentParsed) {
		const todoTotal = parsed.todos.length;
		const todoCompleted = parsed.todos.filter((item) => item.checked).length;

		recentTodoTotal += todoTotal;
		recentTodoCompleted += todoCompleted;

		let noteEventMinutes = 0;
		const noteCategoryMinutesMap = new Map<string, number>();

		for (const item of parsed.timeline) {
			const dur = timelineDurationMinutes(item);
			recentEventMinutes += dur;
			noteEventMinutes += dur;

			// Exact, case-sensitive match on displayName — same semantics as
			// TimelineView.tsx/pdfExport.ts. A category string that doesn't match
			// any configured category (renamed/deleted since the line was written,
			// see settings.ts CustomCategory) is folded into "uncategorized" here
			// instead of being tracked under its own stale key and silently
			// excluded from categoryBreakdown below.
			const cat = item.category ? categories.find((c) => c.displayName === item.category) : undefined;
			if (cat) {
				categoryMinutesMap.set(cat.displayName, (categoryMinutesMap.get(cat.displayName) ?? 0) + dur);
				noteCategoryMinutesMap.set(cat.displayName, (noteCategoryMinutesMap.get(cat.displayName) ?? 0) + dur);
			} else {
				uncategorizedMinutes += dur;
				noteCategoryMinutesMap.set(uncategorizedLabel, (noteCategoryMinutesMap.get(uncategorizedLabel) ?? 0) + dur);
			}
		}

		let noteTopCategory: string | null = null;
		let noteMaxMin = 0;
		for (const [catName, mins] of noteCategoryMinutesMap.entries()) {
			if (mins > noteMaxMin) {
				noteMaxMin = mins;
				noteTopCategory = catName;
			}
		}

		recentNotesSummary.push({
			date,
			todoTotal,
			todoCompleted,
			eventMinutes: noteEventMinutes,
			topCategory: noteTopCategory,
		});
	}

	// Calculate overall category breakdown
	const categoryBreakdown: CategoryStatItem[] = [];
	for (const cat of categories) {
		const mins = categoryMinutesMap.get(cat.displayName) ?? 0;
		if (mins > 0) {
			const percentage = recentEventMinutes > 0 ? Math.round((mins / recentEventMinutes) * 100) : 0;
			categoryBreakdown.push({
				displayName: cat.displayName,
				color: cat.color,
				minutes: mins,
				percentage,
			});
		}
	}

	if (uncategorizedMinutes > 0) {
		const percentage = recentEventMinutes > 0 ? Math.round((uncategorizedMinutes / recentEventMinutes) * 100) : 0;
		categoryBreakdown.push({
			displayName: uncategorizedLabel,
			color: "#94a3b8", // Slate gray for uncategorized
			minutes: uncategorizedMinutes,
			percentage,
		});
	}

	categoryBreakdown.sort((a, b) => b.minutes - a.minutes);

	const topCategoryName = categoryBreakdown.length > 0 ? categoryBreakdown[0].displayName : null;
	const activeDaysCount = Math.max(1, recentParsed.length);
	const avgEventMinutesPerDay = Math.round(recentEventMinutes / activeDaysCount);

	return {
		totalNotes: allNoteDates.length,
		oldestDate,
		newestDate,
		currentStreak,
		recentTodoTotal,
		recentTodoCompleted,
		recentEventMinutes,
		avgEventMinutesPerDay,
		topCategoryName,
		categoryBreakdown,
		recentNotesSummary,
	};
}

