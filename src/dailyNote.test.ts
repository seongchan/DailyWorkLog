import { describe, expect, it } from "vitest";
import { buildSkeletonContent, formatDateBasename, formatDateFilename, isInDailyNoteFolder, parseDateFromBasename } from "./dailyNote";

describe("parseDateFromBasename", () => {
	it("parses a valid YYYY-MM-DD basename", () => {
		expect(parseDateFromBasename("2026-07-13")).toEqual(new Date(2026, 6, 13));
	});

	it("returns null for a basename that doesn't match the pattern at all", () => {
		expect(parseDateFromBasename("not-a-date")).toBeNull();
		expect(parseDateFromBasename("2026-7-13")).toBeNull(); // must be zero-padded
	});

	it("rejects a day that overflows its month instead of silently rolling over", () => {
		// 2026-02-31 would otherwise roll over to 2026-03-03 via the Date constructor.
		expect(parseDateFromBasename("2026-02-31")).toBeNull();
	});

	it("rejects an out-of-range month instead of silently rolling over into the next year", () => {
		expect(parseDateFromBasename("2026-13-01")).toBeNull();
	});

	it("accepts Feb 29 on a leap year but rejects it on a non-leap year", () => {
		expect(parseDateFromBasename("2024-02-29")).toEqual(new Date(2024, 1, 29));
		expect(parseDateFromBasename("2026-02-29")).toBeNull();
	});
});

describe("formatDateBasename / formatDateFilename", () => {
	it("zero-pads month and day", () => {
		expect(formatDateBasename(new Date(2026, 0, 5))).toBe("2026-01-05");
		expect(formatDateFilename(new Date(2026, 0, 5))).toBe("2026-01-05.md");
	});

	it("round-trips through parseDateFromBasename", () => {
		const date = new Date(2026, 6, 13);
		expect(parseDateFromBasename(formatDateBasename(date))).toEqual(date);
	});
});

describe("buildSkeletonContent", () => {
	it("puts exactly one blank line after each marker, including the last one", () => {
		const lines = buildSkeletonContent("en").split("\n");
		expect(lines).toEqual(["# Event", "", "# ToDo", "", "# Diary", ""]);
	});

	it("uses the Korean labels when language is ko", () => {
		const lines = buildSkeletonContent("ko").split("\n");
		expect(lines).toEqual(["# 이벤트", "", "# 할일", "", "# 다이어리", ""]);
	});

	it("never scaffolds the legacy underscore-prefixed spelling (AGENTS.md 1.3)", () => {
		expect(buildSkeletonContent("en")).not.toContain("_Event");
		expect(buildSkeletonContent("ko")).not.toContain("_이벤트");
	});
});

describe("isInDailyNoteFolder", () => {
	it("returns true for any path when folder setting is empty or whitespace", () => {
		expect(isInDailyNoteFolder("2026-07-13.md", "")).toBe(true);
		expect(isInDailyNoteFolder("Daily Notes/2026-07-13.md", "   ")).toBe(true);
	});

	it("returns true when file path is directly inside the configured folder", () => {
		expect(isInDailyNoteFolder("Daily Notes/2026-07-13.md", "Daily Notes")).toBe(true);
		expect(isInDailyNoteFolder("Daily Notes/2026-07-13.md", "Daily Notes/")).toBe(true);
	});

	it("returns true when file is inside a subfolder of the configured folder", () => {
		expect(isInDailyNoteFolder("journals/2026/07/2026-07-13.md", "journals")).toBe(true);
	});

	it("returns false when file is outside the configured folder", () => {
		expect(isInDailyNoteFolder("2026-07-13.md", "Daily Notes")).toBe(false);
		expect(isInDailyNoteFolder("Other Folder/2026-07-13.md", "Daily Notes")).toBe(false);
		expect(isInDailyNoteFolder("Daily Notes Extra/2026-07-13.md", "Daily Notes")).toBe(false);
	});
});

