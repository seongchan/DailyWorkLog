import { describe, expect, it } from "vitest";
import { computeDashboardStats, getRecentWindowStart } from "./dashboardCollector";
import type { ParsedDailyNote } from "./parser";

const EMPTY_NOTE: ParsedDailyNote = { timeline: [], todos: [] };

describe("getRecentWindowStart", () => {
	it("returns the day exactly 29 days before today (30-day window, inclusive)", () => {
		const today = new Date(2026, 6, 30); // 2026-07-30
		const start = getRecentWindowStart(today);
		expect(start).toEqual(new Date(2026, 6, 1)); // 2026-07-01
	});
});

describe("computeDashboardStats", () => {
	it("returns all zeros/nulls for an empty vault", () => {
		const stats = computeDashboardStats([], [], new Date(2026, 6, 14));
		expect(stats.totalNotes).toBe(0);
		expect(stats.oldestDate).toBeNull();
		expect(stats.newestDate).toBeNull();
		expect(stats.currentStreak).toBe(0);
		expect(stats.recentTodoTotal).toBe(0);
		expect(stats.recentTodoCompleted).toBe(0);
		expect(stats.recentEventMinutes).toBe(0);
		expect(stats.avgEventMinutesPerDay).toBe(0);
		expect(stats.topCategoryName).toBeNull();
		expect(stats.categoryBreakdown).toEqual([]);
		expect(stats.recentNotesSummary).toEqual([]);
	});

	it("computes total count and oldest/newest regardless of input order", () => {
		const dates = [new Date(2026, 6, 10), new Date(2026, 5, 1), new Date(2026, 6, 14)];
		const stats = computeDashboardStats(dates, [], new Date(2026, 6, 14));
		expect(stats.totalNotes).toBe(3);
		expect(stats.oldestDate).toEqual(new Date(2026, 5, 1));
		expect(stats.newestDate).toEqual(new Date(2026, 6, 14));
	});

	it("counts a consecutive streak ending today", () => {
		const today = new Date(2026, 6, 14);
		const dates = [new Date(2026, 6, 12), new Date(2026, 6, 13), new Date(2026, 6, 14)];
		expect(computeDashboardStats(dates, [], today).currentStreak).toBe(3);
	});

	it("stops the streak at the first gap", () => {
		const today = new Date(2026, 6, 14);
		const dates = [new Date(2026, 6, 10), new Date(2026, 6, 13), new Date(2026, 6, 14)]; // gap at 11/12
		expect(computeDashboardStats(dates, [], today).currentStreak).toBe(2);
	});

	it("streak is 0 if today itself has no note", () => {
		const today = new Date(2026, 6, 14);
		const dates = [new Date(2026, 6, 12), new Date(2026, 6, 13)];
		expect(computeDashboardStats(dates, [], today).currentStreak).toBe(0);
	});

	it("aggregates recent To-Do completion, category breakdown, and daily average", () => {
		const today = new Date(2026, 6, 14);
		const dates = [new Date(2026, 6, 14)];
		const recentParsed = [
			{
				date: new Date(2026, 6, 14),
				parsed: {
					timeline: [
						{ line: 0, lineCount: 1, start: "09:00", end: "10:30", category: "Work", description: "work task" },
						{ line: 1, lineCount: 1, start: "11:00", end: "12:00", category: "Study", description: "study task" },
					],
					todos: [
						{ line: 2, lineCount: 1, checked: true, text: "a" },
						{ line: 3, lineCount: 1, checked: false, text: "b" },
					],
				} satisfies ParsedDailyNote,
			},
		];

		const customCategories = [
			{ name: "Work", displayName: "Work", color: "#d0e1fd" },
			{ name: "Study", displayName: "Study", color: "#ebd3f8" },
		];

		const stats = computeDashboardStats(dates, recentParsed, today, customCategories);
		expect(stats.recentTodoTotal).toBe(2);
		expect(stats.recentTodoCompleted).toBe(1);
		expect(stats.recentEventMinutes).toBe(150); // 90m + 60m
		expect(stats.avgEventMinutesPerDay).toBe(150);
		expect(stats.topCategoryName).toBe("Work");
		expect(stats.categoryBreakdown).toHaveLength(2);
		expect(stats.categoryBreakdown[0]).toEqual({
			displayName: "Work",
			color: "#d0e1fd",
			minutes: 90,
			percentage: 60,
		});
		expect(stats.categoryBreakdown[1]).toEqual({
			displayName: "Study",
			color: "#ebd3f8",
			minutes: 60,
			percentage: 40,
		});

		expect(stats.recentNotesSummary).toHaveLength(1);
		expect(stats.recentNotesSummary[0].topCategory).toBe("Work");
		expect(stats.recentNotesSummary[0].todoTotal).toBe(2);
	});

	it("folds a category no longer present in settings into uncategorized, rather than dropping its minutes", () => {
		// A timeline line's [Category] token is stored verbatim (settings.ts
		// CustomCategory doc): if the category was later renamed or deleted, the
		// old text stops matching any configured category and must render as
		// uncategorized — its minutes must still be accounted for somewhere in
		// categoryBreakdown, not silently excluded.
		const today = new Date(2026, 6, 14);
		const dates = [today];
		const recentParsed = [
			{
				date: today,
				parsed: {
					timeline: [
						{ line: 0, lineCount: 1, start: "09:00", end: "10:00", category: "Work", description: "a" },
						{ line: 1, lineCount: 1, start: "10:00", end: "11:00", category: "OldRenamedCategory", description: "b" },
					],
					todos: [],
				} satisfies ParsedDailyNote,
			},
		];
		const customCategories = [{ name: "Work", displayName: "Work", color: "#d0e1fd" }];

		const stats = computeDashboardStats(dates, recentParsed, today, customCategories, "Uncategorized");
		expect(stats.recentEventMinutes).toBe(120);
		const totalBreakdownMinutes = stats.categoryBreakdown.reduce((sum, item) => sum + item.minutes, 0);
		expect(totalBreakdownMinutes).toBe(stats.recentEventMinutes);
		expect(stats.categoryBreakdown.find((item) => item.displayName === "Uncategorized")?.minutes).toBe(60);
	});

	it("matches category names exactly (case-sensitive), same as TimelineView/pdfExport", () => {
		const today = new Date(2026, 6, 14);
		const dates = [today];
		const recentParsed = [
			{
				date: today,
				parsed: {
					timeline: [{ line: 0, lineCount: 1, start: "09:00", end: "10:00", category: "work", description: "a" }],
					todos: [],
				} satisfies ParsedDailyNote,
			},
		];
		const customCategories = [{ name: "Work", displayName: "Work", color: "#d0e1fd" }];

		const stats = computeDashboardStats(dates, recentParsed, today, customCategories, "Uncategorized");
		expect(stats.categoryBreakdown).toEqual([
			{ displayName: "Uncategorized", color: "#94a3b8", minutes: 60, percentage: 100 },
		]);
	});

	it("ignores empty parsed notes without error", () => {
		const today = new Date(2026, 6, 14);
		const stats = computeDashboardStats(
			[today],
			[{ date: today, parsed: EMPTY_NOTE }],
			today
		);
		expect(stats.recentTodoTotal).toBe(0);
		expect(stats.recentEventMinutes).toBe(0);
	});
});

