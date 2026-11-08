import { describe, expect, it } from "vitest";
import {
	buildSkeletonContent,
	formatDateBasename,
	formatNoteFilePath,
	getNoteRelativePath,
	isInDailyNoteFolder,
	parseDateFromBasename,
	parseDateFromNotePath,
} from "./dailyNote";

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

	it("supports a custom moment.js format, matching the core Daily Notes plugin's `format` option", () => {
		expect(parseDateFromBasename("13-07-2026", "DD-MM-YYYY")).toEqual(new Date(2026, 6, 13));
		expect(parseDateFromBasename("2026-7-13", "DD-MM-YYYY")).toBeNull(); // shape mismatch against the given format
	});
});

describe("formatDateBasename", () => {
	it("zero-pads month and day, independent of any configured dateFormat", () => {
		expect(formatDateBasename(new Date(2026, 0, 5))).toBe("2026-01-05");
	});

	it("round-trips through parseDateFromBasename", () => {
		const date = new Date(2026, 6, 13);
		expect(parseDateFromBasename(formatDateBasename(date))).toEqual(date);
	});
});

describe("formatNoteFilePath / parseDateFromNotePath (dynamic-folder date formats)", () => {
	it("defaults to the original flat YYYY-MM-DD.md behavior", () => {
		const date = new Date(2026, 8, 1);
		expect(formatNoteFilePath(date, "")).toBe("2026-09-01.md");
		expect(formatNoteFilePath(date, "Daily Notes")).toBe("Daily Notes/2026-09-01.md");
	});

	it("a '/' in the format produces nested year/month subfolders, matching the core Daily Notes plugin", () => {
		const date = new Date(2026, 8, 1);
		expect(formatNoteFilePath(date, "Journal", "YYYY/MM/YYYY-MM-DD")).toBe("Journal/2026/09/2026-09-01.md");
	});

	it("round-trips a nested-folder path back to the original date", () => {
		const date = new Date(2026, 8, 1);
		const format = "YYYY/MM/YYYY-MM-DD";
		const path = formatNoteFilePath(date, "Journal", format);
		expect(parseDateFromNotePath(path, "Journal", format)).toEqual(date);
	});

	it("returns null for a file outside the configured folder or not matching the format", () => {
		expect(parseDateFromNotePath("Other/2026-09-01.md", "Journal", "YYYY-MM-DD")).toBeNull();
		expect(parseDateFromNotePath("Journal/2026/09/2026-09-01.md", "Journal", "YYYY-MM-DD")).toBeNull();
	});
});

describe("getNoteRelativePath", () => {
	it("strips the folder prefix and .md extension, preserving nested segments", () => {
		expect(getNoteRelativePath("Journal/2026/09/2026-09-01.md", "Journal")).toBe("2026/09/2026-09-01");
		expect(getNoteRelativePath("2026-09-01.md", "")).toBe("2026-09-01");
	});

	it("returns null for a non-.md file or a file outside the folder", () => {
		expect(getNoteRelativePath("Journal/2026-09-01.canvas", "Journal")).toBeNull();
		expect(getNoteRelativePath("Other/2026-09-01.md", "Journal")).toBeNull();
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

