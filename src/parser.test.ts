import { describe, expect, it } from "vitest";
import {
	appendLineToBlock,
	parseDailyNote,
	parseTimeline,
	parseTodo,
	removeLineAt,
	replaceLineAt,
	splitBlocksByMarker,
	stripFrontmatter,
	timelineDurationMinutes,
	timelineLineMatches,
	TIME_VALUE_REGEX,
	timeToMinutes,
	todoLineMatches,
} from "./parser";

describe("stripFrontmatter", () => {
	it("returns bodyStart 0 when there is no frontmatter", () => {
		const content = "# _Event\n- 9:00 - 10:00 work";
		const { bodyStart } = stripFrontmatter(content);
		expect(bodyStart).toBe(0);
	});

	it("skips a leading YAML frontmatter block", () => {
		const content = ["---", "tags: [work]", "---", "# _Event", "- 9:00 - 10:00 work"].join("\n");
		const { lines, bodyStart } = stripFrontmatter(content);
		expect(bodyStart).toBe(3);
		expect(lines[bodyStart]).toBe("# _Event");
	});

	it("does not treat an unterminated leading --- as frontmatter", () => {
		const content = ["---", "# _Event", "- 9:00 - 10:00 work"].join("\n");
		const { bodyStart } = stripFrontmatter(content);
		expect(bodyStart).toBe(0);
	});

	it("requires an EXACT --- match, not just trimmed whitespace (AGENTS.md 1.2)", () => {
		const content = [" --- ", "not real frontmatter", "---", "# _Event"].join("\n");
		const { bodyStart } = stripFrontmatter(content);
		expect(bodyStart).toBe(0);
	});

	it("still recognizes the delimiter on CRLF-terminated files", () => {
		const content = ["---", "tags: [work]", "---", "# _ToDo", "- [ ] task"].join("\r\n");
		const { bodyStart } = stripFrontmatter(content);
		expect(bodyStart).toBe(3);
	});
});

describe("splitBlocksByMarker", () => {
	it("flags legacy mode when no markers are present", () => {
		const lines = ["- 9:00 - 10:00 work", "- [ ] task"];
		const layout = splitBlocksByMarker(lines, 0);
		expect(layout.legacy).toBe(true);
	});

	it("splits blocks regardless of marker order (English labels)", () => {
		const lines = [
			"# _ToDo",
			"- [ ] task",
			"# _Event",
			"- 9:00 - 10:00 work",
			"# _Diary",
			"free text",
		];
		const layout = splitBlocksByMarker(lines, 0);
		expect(layout.legacy).toBe(false);
		expect(layout.blocks.todo).toEqual({ start: 1, end: 1 });
		expect(layout.blocks.timeline).toEqual({ start: 3, end: 3 });
		expect(layout.blocks.journal).toEqual({ start: 5, end: 5 });
	});

	it("recognizes Korean marker labels the same way", () => {
		const lines = ["# _이벤트", "- 9:00 - 10:00 회의", "# _할일", "- [ ] 작업", "# _다이어리", "메모"];
		const layout = splitBlocksByMarker(lines, 0);
		expect(layout.legacy).toBe(false);
		expect(layout.blocks.timeline).toEqual({ start: 1, end: 1 });
		expect(layout.blocks.todo).toEqual({ start: 3, end: 3 });
		expect(layout.blocks.journal).toEqual({ start: 5, end: 5 });
	});

	it("recognizes a mix of English and Korean labels in the same file", () => {
		// e.g. a note started under one language setting, edited after switching.
		const lines = ["# _Event", "- 9:00 - 10:00 work", "# _할일", "- [ ] task", "# _Diary", "notes"];
		const layout = splitBlocksByMarker(lines, 0);
		expect(layout.blocks.timeline).toEqual({ start: 1, end: 1 });
		expect(layout.blocks.todo).toEqual({ start: 3, end: 3 });
		expect(layout.blocks.journal).toEqual({ start: 5, end: 5 });
	});

	it("treats a duplicate marker line (even in a different language) as ordinary content", () => {
		const lines = [
			"# _Event",
			"- 9:00 - 10:00 work",
			"# _ToDo",
			"- [ ] task",
			"# _이벤트", // duplicate of the "timeline" type, different language — should NOT end the To-Do block early
			"- [ ] another task",
			"# _Diary",
			"notes",
		];
		const layout = splitBlocksByMarker(lines, 0);
		expect(layout.blocks.timeline).toEqual({ start: 1, end: 1 });
		expect(layout.blocks.todo).toEqual({ start: 3, end: 5 });
		expect(layout.blocks.journal).toEqual({ start: 7, end: 7 });

		const todos = parseTodo(lines, layout.blocks.todo!);
		expect(todos).toHaveLength(2);
	});

	it("is tolerant of case and surrounding whitespace in marker text", () => {
		const lines = ["#   _todo  ", "- [ ] task"];
		const layout = splitBlocksByMarker(lines, 0);
		expect(layout.blocks.todo).toEqual({ start: 1, end: 1 });
	});
});

describe("parseTimeline", () => {
	it("extracts start, end, description and line index", () => {
		const lines = ["# _Event", "- 09:00 - 10:30 Coding session"];
		const items = parseTimeline(lines, { start: 0, end: 1 });
		expect(items).toEqual([{ line: 1, start: "09:00", end: "10:30", description: "Coding session" }]);
	});

	it("allows single-digit hours and a tilde separator", () => {
		const lines = ["- 9:00~10:00 short form"];
		const items = parseTimeline(lines, { start: 0, end: 0 });
		expect(items[0]).toMatchObject({ start: "9:00", end: "10:00" });
	});
});

describe("parseTodo", () => {
	it("extracts checked state, text and line index, tracking duplicates separately", () => {
		const lines = ["- [x] Ship plan", "- [ ] Ship plan", "- [ ] Ship plan"];
		const items = parseTodo(lines, { start: 0, end: 2 });
		expect(items).toEqual([
			{ line: 0, checked: true, text: "Ship plan" },
			{ line: 1, checked: false, text: "Ship plan" },
			{ line: 2, checked: false, text: "Ship plan" },
		]);
	});
});

describe("parseDailyNote (full pipeline)", () => {
	it("parses a well-formed note with all three English markers", () => {
		const content = [
			"# _Event",
			"- 9:00 - 10:30 회의",
			"# _ToDo",
			"- [x] 완료된 작업",
			"- [ ] 남은 작업",
			"# _Diary",
			"자유 메모",
		].join("\n");

		const result = parseDailyNote(content);
		expect(result.timeline).toEqual([{ line: 1, start: "9:00", end: "10:30", description: "회의" }]);
		expect(result.todos).toEqual([
			{ line: 3, checked: true, text: "완료된 작업" },
			{ line: 4, checked: false, text: "남은 작업" },
		]);
	});

	it("parses a well-formed note with all three Korean markers", () => {
		const content = [
			"# _이벤트",
			"- 9:00 - 10:30 회의",
			"# _할일",
			"- [x] 완료된 작업",
			"# _다이어리",
			"자유 메모",
		].join("\n");

		const result = parseDailyNote(content);
		expect(result.timeline).toEqual([{ line: 1, start: "9:00", end: "10:30", description: "회의" }]);
		expect(result.todos).toEqual([{ line: 3, checked: true, text: "완료된 작업" }]);
	});

	it("falls back to legacy heuristics when no markers exist, and does not auto-insert them", () => {
		const content = ["- 9:00 - 10:00 work", "- [ ] task", "- [x] done"].join("\n");
		const result = parseDailyNote(content);
		expect(result.timeline).toHaveLength(1);
		expect(result.todos).toHaveLength(2);
	});

	it("keeps line indices relative to the original file when frontmatter precedes markers", () => {
		const content = ["---", "tags: [work]", "---", "# _ToDo", "- [ ] task after frontmatter"].join("\n");

		const result = parseDailyNote(content);
		expect(result.todos).toEqual([{ line: 4, checked: false, text: "task after frontmatter" }]);
	});
});

describe("appendLineToBlock", () => {
	it("appends inside the target block, right before the next marker", () => {
		const content = ["# _Event", "- 9:00 - 10:00 work", "# _ToDo", "", "# _Diary", ""].join("\n");
		const result = appendLineToBlock(content, "todo", "- [ ] new task");
		expect(result.split("\n")).toEqual([
			"# _Event",
			"- 9:00 - 10:00 work",
			"# _ToDo",
			"",
			"- [ ] new task",
			"# _Diary",
			"",
		]);
	});

	it("appends a second item after the first, still before the next marker", () => {
		const content = ["# _ToDo", "", "- [ ] task1", "# _Diary", ""].join("\n");
		const result = appendLineToBlock(content, "todo", "- [ ] task2");
		expect(result.split("\n")).toEqual(["# _ToDo", "", "- [ ] task1", "- [ ] task2", "# _Diary", ""]);
	});

	it("appends to end of file when the block is the last one", () => {
		const content = ["# _ToDo", "", "- [ ] task1"].join("\n");
		const result = appendLineToBlock(content, "todo", "- [ ] task2");
		expect(result.split("\n")).toEqual(["# _ToDo", "", "- [ ] task1", "- [ ] task2"]);
	});

	it("appends to end of file for legacy (marker-less) files", () => {
		const content = ["- [ ] task1"].join("\n");
		const result = appendLineToBlock(content, "todo", "- [ ] task2");
		expect(result.split("\n")).toEqual(["- [ ] task1", "- [ ] task2"]);
	});

	it("appends to end of file when the specific block marker is simply absent", () => {
		const content = ["# _Event", "- 9:00 - 10:00 work"].join("\n");
		const result = appendLineToBlock(content, "todo", "- [ ] task1");
		expect(result.split("\n")).toEqual(["# _Event", "- 9:00 - 10:00 work", "- [ ] task1"]);
	});

	it("does not turn a trailing newline into a blank line when the block is last (EOF)", () => {
		// Many editors save files with a trailing "\n", so content.split("\n")
		// ends with an empty string that must not be treated as real content.
		const content = "# _ToDo\n\n- [ ] task1\n";
		const result = appendLineToBlock(content, "todo", "- [ ] task2");
		expect(result).toBe("# _ToDo\n\n- [ ] task1\n- [ ] task2\n");
	});

	it("does not compound extra blank lines across repeated appends with a trailing newline", () => {
		let content = "# _ToDo\n";
		content = appendLineToBlock(content, "todo", "- [ ] task1");
		expect(content).toBe("# _ToDo\n- [ ] task1\n"); // still exactly one trailing newline
		content = appendLineToBlock(content, "todo", "- [ ] task2");
		expect(content).toBe("# _ToDo\n- [ ] task1\n- [ ] task2\n");
	});

	it("still appends plainly when there is no trailing newline and no marker at all", () => {
		const content = "- [ ] task1";
		const result = appendLineToBlock(content, "todo", "- [ ] task2");
		expect(result).toBe("- [ ] task1\n- [ ] task2");
	});
});

describe("replaceLineAt / removeLineAt", () => {
	it("replaces only the targeted line", () => {
		const content = ["a", "b", "c"].join("\n");
		expect(replaceLineAt(content, 1, "B")).toBe(["a", "B", "c"].join("\n"));
	});

	it("removes only the targeted line", () => {
		const content = ["a", "b", "c"].join("\n");
		expect(removeLineAt(content, 1)).toBe(["a", "c"].join("\n"));
	});
});

describe("todoLineMatches / timelineLineMatches", () => {
	it("matches when checked state and text are unchanged", () => {
		const item = { line: 0, checked: false, text: "task" };
		expect(todoLineMatches("- [ ] task", item)).toBe(true);
		expect(todoLineMatches("- [x] task", item)).toBe(false); // checked state changed
		expect(todoLineMatches("- [ ] different", item)).toBe(false); // text changed
		expect(todoLineMatches("# _ToDo", item)).toBe(false); // not a checkbox line at all
	});

	it("matches timeline items on start/end/description", () => {
		const item = { line: 0, start: "9:00", end: "10:00", description: "work" };
		expect(timelineLineMatches("- 9:00 - 10:00 work", item)).toBe(true);
		expect(timelineLineMatches("- 9:00 - 10:30 work", item)).toBe(false); // end changed
		expect(timelineLineMatches("- 9:00 - 10:00 something else", item)).toBe(false); // description changed
	});
});

describe("timeToMinutes / timelineDurationMinutes", () => {
	it("converts HH:mm to minutes-since-midnight", () => {
		expect(timeToMinutes("9:00")).toBe(540);
		expect(timeToMinutes("00:00")).toBe(0);
		expect(timeToMinutes("23:59")).toBe(1439);
	});

	it("computes a same-day duration", () => {
		expect(timelineDurationMinutes({ start: "9:00", end: "10:30" })).toBe(90);
	});

	it("treats end <= start as crossing midnight", () => {
		expect(timelineDurationMinutes({ start: "23:00", end: "01:00" })).toBe(120);
		expect(timelineDurationMinutes({ start: "9:00", end: "9:00" })).toBe(24 * 60);
	});
});

describe("TIME_VALUE_REGEX", () => {
	it("accepts valid HH:mm values, single- or double-digit hour", () => {
		expect(TIME_VALUE_REGEX.test("0:00")).toBe(true);
		expect(TIME_VALUE_REGEX.test("00:00")).toBe(true);
		expect(TIME_VALUE_REGEX.test("9:00")).toBe(true);
		expect(TIME_VALUE_REGEX.test("09:00")).toBe(true);
		expect(TIME_VALUE_REGEX.test("23:59")).toBe(true);
	});

	it("rejects out-of-range hours or minutes instead of just checking digit shape", () => {
		expect(TIME_VALUE_REGEX.test("99:99")).toBe(false);
		expect(TIME_VALUE_REGEX.test("25:80")).toBe(false);
		expect(TIME_VALUE_REGEX.test("24:00")).toBe(false);
		expect(TIME_VALUE_REGEX.test("12:60")).toBe(false);
	});

	it("rejects malformed strings", () => {
		expect(TIME_VALUE_REGEX.test("9:0")).toBe(false);
		expect(TIME_VALUE_REGEX.test("9-00")).toBe(false);
		expect(TIME_VALUE_REGEX.test("")).toBe(false);
	});
});
