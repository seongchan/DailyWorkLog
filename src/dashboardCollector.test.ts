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
		expect(stats).toEqual({
			totalNotes: 0,
			oldestDate: null,
			newestDate: null,
			currentStreak: 0,
			recentTodoTotal: 0,
			recentTodoCompleted: 0,
			recentEventMinutes: 0,
		});
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

	it("aggregates recent To-Do completion and Event minutes only from recentParsed", () => {
		const today = new Date(2026, 6, 14);
		const dates = [new Date(2026, 6, 14)];
		const recentParsed = [
			{
				date: new Date(2026, 6, 14),
				parsed: {
					timeline: [{ line: 0, start: "9:00", end: "10:30", description: "work" }],
					todos: [
						{ line: 1, checked: true, text: "a" },
						{ line: 2, checked: false, text: "b" },
					],
				} satisfies ParsedDailyNote,
			},
		];

		const stats = computeDashboardStats(dates, recentParsed, today);
		expect(stats.recentTodoTotal).toBe(2);
		expect(stats.recentTodoCompleted).toBe(1);
		expect(stats.recentEventMinutes).toBe(90);
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
