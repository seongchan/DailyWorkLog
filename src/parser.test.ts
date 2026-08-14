import { describe, expect, it } from "vitest";
import {
	appendLineToBlock,
	isTopLevelOrMarker,
	parseDailyNote,
	parseTimeline,
	parseTodo,
	removeLineAt,
	removeLineRangeAt,
	replaceLineAt,
	replaceLineRangeAt,
	splitBlocksByMarker,
	stripFrontmatter,
	timelineDurationMinutes,
	timelineLineMatches,
	timelineRangeMatches,
	TIME_VALUE_REGEX,
	timeToMinutes,
	minutesToTime,
	todoLineMatches,
	todoRangeMatches,
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

	it("recognizes the no-underscore marker spelling (2026-08 default, AGENTS.md 1.3)", () => {
		const lines = ["# Event", "- 9:00 - 10:00 work", "# ToDo", "- [ ] task", "# Diary", "notes"];
		const layout = splitBlocksByMarker(lines, 0);
		expect(layout.legacy).toBe(false);
		expect(layout.blocks.timeline).toEqual({ start: 1, end: 1 });
		expect(layout.blocks.todo).toEqual({ start: 3, end: 3 });
		expect(layout.blocks.journal).toEqual({ start: 5, end: 5 });
	});

	it("recognizes the no-underscore Korean marker spelling", () => {
		const lines = ["# 이벤트", "- 9:00 - 10:00 회의", "# 할일", "- [ ] 작업"];
		const layout = splitBlocksByMarker(lines, 0);
		expect(layout.blocks.timeline).toEqual({ start: 1, end: 1 });
		expect(layout.blocks.todo).toEqual({ start: 3, end: 3 });
	});

	it("recognizes a mix of legacy underscore and current no-underscore spellings in the same file", () => {
		// e.g. a note started before the 2026-08 spelling change, edited after upgrading.
		const lines = ["# _Event", "- 9:00 - 10:00 work", "# ToDo", "- [ ] task", "# _Diary", "notes"];
		const layout = splitBlocksByMarker(lines, 0);
		expect(layout.blocks.timeline).toEqual({ start: 1, end: 1 });
		expect(layout.blocks.todo).toEqual({ start: 3, end: 3 });
		expect(layout.blocks.journal).toEqual({ start: 5, end: 5 });
	});
});

describe("parseTimeline", () => {
	it("extracts start, end, description and line index", () => {
		const lines = ["# _Event", "- 09:00 - 10:30 Coding session"];
		const items = parseTimeline(lines, { start: 0, end: 1 });
		expect(items).toEqual([
			{ line: 1, lineCount: 1, start: "09:00", end: "10:30", category: undefined, description: "Coding session" },
		]);
	});

	it("allows single-digit hours and a tilde separator", () => {
		const lines = ["- 9:00~10:00 short form"];
		const items = parseTimeline(lines, { start: 0, end: 0 });
		expect(items[0]).toMatchObject({ start: "9:00", end: "10:00" });
	});

	it("extracts an optional [Category] token (AGENTS.md 1.4.1)", () => {
		const lines = ["- 09:00 - 10:30 [업무] 회의 준비"];
		const items = parseTimeline(lines, { start: 0, end: 0 });
		expect(items).toEqual([
			{ line: 0, lineCount: 1, start: "09:00", end: "10:30", category: "업무", description: "회의 준비" },
		]);
	});

	it("treats lines without a [Category] token as uncategorized (category: undefined)", () => {
		// Pre-category-feature lines must keep parsing exactly as before.
		const lines = ["- 09:00 - 10:30 Coding session"];
		const items = parseTimeline(lines, { start: 0, end: 0 });
		expect(items[0].category).toBeUndefined();
	});

	it("allows a category with no trailing description", () => {
		const lines = ["- 09:00 - 10:30 [Work]"];
		const items = parseTimeline(lines, { start: 0, end: 0 });
		expect(items[0]).toMatchObject({ category: "Work", description: "" });
	});

	it("treats an empty [] category token as uncategorized rather than an empty string", () => {
		const lines = ["- 09:00 - 10:30 [] some text"];
		const items = parseTimeline(lines, { start: 0, end: 0 });
		expect(items[0]).toMatchObject({ category: undefined, description: "some text" });
	});
});

describe("parseTodo", () => {
	it("extracts checked state, text and line index, tracking duplicates separately", () => {
		const lines = ["- [x] Ship plan", "- [ ] Ship plan", "- [ ] Ship plan"];
		const items = parseTodo(lines, { start: 0, end: 2 });
		expect(items).toEqual([
			{ line: 0, lineCount: 1, checked: true, text: "Ship plan" },
			{ line: 1, lineCount: 1, checked: false, text: "Ship plan" },
			{ line: 2, lineCount: 1, checked: false, text: "Ship plan" },
		]);
	});
});

describe("isTopLevelOrMarker", () => {
	it("recognizes both blocks' top-level shapes and marker headings", () => {
		expect(isTopLevelOrMarker("- 9:00 - 10:00 work")).toBe(true);
		expect(isTopLevelOrMarker("- [ ] task")).toBe(true);
		expect(isTopLevelOrMarker("- [x] task")).toBe(true);
		expect(isTopLevelOrMarker("# Event")).toBe(true);
		expect(isTopLevelOrMarker("# _할일")).toBe(true);
	});

	it("returns false for plain text and indented continuation-shaped lines", () => {
		expect(isTopLevelOrMarker("some plain note")).toBe(false);
		expect(isTopLevelOrMarker(" - indented dash, not column 0 anchored")).toBe(false);
		expect(isTopLevelOrMarker("")).toBe(false);
	});
});

describe("continuation lines (AGENTS.md 1.4.2)", () => {
	it("parseTimeline absorbs non-matching lines into the preceding item's description and tracks lineCount", () => {
		const lines = ["- 9:00 - 10:00 [Work] weekly report", "extra detail line 1", "extra detail line 2"];
		const items = parseTimeline(lines, { start: 0, end: 2 });
		expect(items).toEqual([
			{
				line: 0,
				lineCount: 3,
				start: "9:00",
				end: "10:00",
				category: "Work",
				description: "weekly report\nextra detail line 1\nextra detail line 2",
			},
		]);
	});

	it("parseTodo absorbs non-matching lines into the preceding item's text and tracks lineCount", () => {
		const lines = ["- [ ] ship the release", "handles the rollback plan too"];
		const items = parseTodo(lines, { start: 0, end: 1 });
		expect(items).toEqual([{ line: 0, lineCount: 2, checked: false, text: "ship the release\nhandles the rollback plan too" }]);
	});

	it("preserves a continuation line's raw leading whitespace verbatim (round-trip fidelity)", () => {
		// Matches the real-world pattern that motivated this feature: pasting a bulleted
		// sub-list from elsewhere leaves a single leading space before each "-".
		const lines = [
			"- 10:10 - 10:40 [Work] 부문장 주간 업무 보고",
			" - 태스크이지 이관자료. 백업 대응 진행 건",
			" - ISO-27001 인증 진행 (8/21. 신청)",
			" - 대신정보 MRP 서버 이관건 의견 전달",
		];
		const items = parseTimeline(lines, { start: 0, end: 3 });
		expect(items).toEqual([
			{
				line: 0,
				lineCount: 4,
				start: "10:10",
				end: "10:40",
				category: "Work",
				description:
					"부문장 주간 업무 보고\n" +
					" - 태스크이지 이관자료. 백업 대응 진행 건\n" +
					" - ISO-27001 인증 진행 (8/21. 신청)\n" +
					" - 대신정보 MRP 서버 이관건 의견 전달",
			},
		]);
	});

	it("absorbs interior blank lines but trims a trailing blank from the collected text (lineCount still counts it)", () => {
		const lines = ["- 9:00 - 10:00 report", "para one", "", "para two", ""];
		const items = parseTimeline(lines, { start: 0, end: 4 });
		expect(items[0].description).toBe("report\npara one\n\npara two");
		expect(items[0].lineCount).toBe(5);
	});

	it("stops absorption at a line matching the OTHER block's top-level shape, without corrupting the current item", () => {
		const lines = ["- 9:00 - 10:00 work", "- [ ] unrelated todo, not a note on the event above"];
		const items = parseTimeline(lines, { start: 0, end: 1 });
		expect(items).toEqual([{ line: 0, lineCount: 1, start: "9:00", end: "10:00", category: undefined, description: "work" }]);
	});

	it("stops absorption at a marker line", () => {
		const lines = ["- [ ] task", "# Diary", "not a note on the task above"];
		const items = parseTodo(lines, { start: 0, end: 2 });
		expect(items).toEqual([{ line: 0, lineCount: 1, checked: false, text: "task" }]);
	});

	it("does not attach a leading orphan line (no preceding item yet) to anything", () => {
		const lines = ["orphan line before any item", "- 9:00 - 10:00 work"];
		const items = parseTimeline(lines, { start: 0, end: 1 });
		expect(items).toEqual([{ line: 1, lineCount: 1, start: "9:00", end: "10:00", category: undefined, description: "work" }]);
	});

	it("a single blank line is absorbed as a paragraph break", () => {
		const lines = ["- 9:00 - 10:00 work", "para one", "", "para two"];
		const items = parseTimeline(lines, { start: 0, end: 3 });
		expect(items[0]).toMatchObject({ lineCount: 4, description: "work\npara one\n\npara two" });
	});

	it("a SECOND consecutive blank line stops absorption, leaving the rest as an orphaned tail excluded from lineCount", () => {
		// Hand-edited files can't be intercepted at write time (only the modal's
		// own save path collapses runs of 3+ typed newlines — see
		// TimelineModal), so this is the read-side guard: two blank lines in a
		// row reads as "unrelated content follows", not a paragraph break.
		const lines = ["- 9:00 - 10:00 [Work] weekly report", "note kept", "", "", "unrelated content typed elsewhere"];
		const items = parseTimeline(lines, { start: 0, end: 4 });
		expect(items).toEqual([
			{ line: 0, lineCount: 3, start: "9:00", end: "10:00", category: "Work", description: "weekly report\nnote kept" },
		]);
	});

	it("the orphaned tail after a double blank line is never touched by a range-bounded re-save of the item above it", () => {
		const content = ["- 9:00 - 10:00 [Work] weekly report", "note kept", "", "", "unrelated content typed elsewhere"].join(
			"\n"
		);
		const { lines } = stripFrontmatter(content);
		const [item] = parseTimeline(lines, { start: 0, end: 4 });
		// Simulate editing just this item and re-saving through the sidebar: it
		// only ever replaces [item.line, item.line + item.lineCount - 1].
		const updated = replaceLineRangeAt(content, item.line, item.lineCount, "- 9:00 - 10:00 [Work] weekly report EDITED");
		expect(updated).toBe(["- 9:00 - 10:00 [Work] weekly report EDITED", "", "unrelated content typed elsewhere"].join("\n"));
	});

	it("applies the same double-blank-line rule to To-Do continuation text", () => {
		const lines = ["- [ ] ship it", "rollback plan documented", "", "", "unrelated note elsewhere in the file"];
		const items = parseTodo(lines, { start: 0, end: 4 });
		expect(items).toEqual([{ line: 0, lineCount: 3, checked: false, text: "ship it\nrollback plan documented" }]);
	});

	it("legacy mode: a foreign-type line resets the continuation chain so a note isn't duplicated onto the wrong item", () => {
		// Regression for imsi.md §8.2: without resetting `current` on a foreign
		// top-level hit, "note for the task" would incorrectly also be absorbed
		// into the timeline item's description during parseTimeline's own pass.
		const content = ["- 9:00 - 10:00 work", "- [ ] task", "note for the task"].join("\n");
		const result = parseDailyNote(content);
		expect(result.timeline).toEqual([{ line: 0, lineCount: 1, start: "9:00", end: "10:00", category: undefined, description: "work" }]);
		expect(result.todos).toEqual([{ line: 1, lineCount: 2, checked: false, text: "task\nnote for the task" }]);
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
		expect(result.timeline).toEqual([{ line: 1, lineCount: 1, start: "9:00", end: "10:30", description: "회의" }]);
		expect(result.todos).toEqual([
			{ line: 3, lineCount: 1, checked: true, text: "완료된 작업" },
			{ line: 4, lineCount: 1, checked: false, text: "남은 작업" },
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
		expect(result.timeline).toEqual([{ line: 1, lineCount: 1, start: "9:00", end: "10:30", description: "회의" }]);
		expect(result.todos).toEqual([{ line: 3, lineCount: 1, checked: true, text: "완료된 작업" }]);
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
		expect(result.todos).toEqual([{ line: 4, lineCount: 1, checked: false, text: "task after frontmatter" }]);
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

describe("replaceLineRangeAt / removeLineRangeAt", () => {
	it("replaces a multi-line span with a single-line replacement", () => {
		const content = ["a", "b1", "b2", "b3", "c"].join("\n");
		expect(replaceLineRangeAt(content, 1, 3, "B")).toBe(["a", "B", "c"].join("\n"));
	});

	it("replaces a span with a replacement that itself spans a different number of physical lines", () => {
		const content = ["a", "b1", "b2", "c"].join("\n");
		expect(replaceLineRangeAt(content, 1, 2, "B1\nB2\nB3")).toBe(["a", "B1", "B2", "B3", "c"].join("\n"));
	});

	it("removes an entire multi-line span", () => {
		const content = ["a", "b1", "b2", "b3", "c"].join("\n");
		expect(removeLineRangeAt(content, 1, 3)).toBe(["a", "c"].join("\n"));
	});

	it("behaves exactly like replaceLineAt / removeLineAt when lineCount is 1", () => {
		const content = ["a", "b", "c"].join("\n");
		expect(replaceLineRangeAt(content, 1, 1, "B")).toBe(replaceLineAt(content, 1, "B"));
		expect(removeLineRangeAt(content, 1, 1)).toBe(removeLineAt(content, 1));
	});
});

describe("timelineRangeMatches / todoRangeMatches", () => {
	it("matches a multi-line event including its continuation lines", () => {
		const lines = ["- 9:00 - 10:00 [Work] report", "note 1", "note 2"];
		const item = { line: 0, lineCount: 3, start: "9:00", end: "10:00", category: "Work", description: "report\nnote 1\nnote 2" };
		expect(timelineRangeMatches(lines, item)).toBe(true);
	});

	it("rejects when a continuation line changed underneath the cached item", () => {
		const lines = ["- 9:00 - 10:00 [Work] report", "note 1 EDITED", "note 2"];
		const item = { line: 0, lineCount: 3, start: "9:00", end: "10:00", category: "Work", description: "report\nnote 1\nnote 2" };
		expect(timelineRangeMatches(lines, item)).toBe(false);
	});

	it("rejects when the file no longer has that many lines in the item's span", () => {
		const lines = ["- 9:00 - 10:00 [Work] report", "note 1"];
		const item = { line: 0, lineCount: 3, start: "9:00", end: "10:00", category: "Work", description: "report\nnote 1\nnote 2" };
		expect(timelineRangeMatches(lines, item)).toBe(false);
	});

	it("matches a multi-line todo including its continuation lines", () => {
		const lines = ["- [ ] ship it", "handles rollback too"];
		const item = { line: 0, lineCount: 2, checked: false, text: "ship it\nhandles rollback too" };
		expect(todoRangeMatches(lines, item)).toBe(true);
	});

	it("rejects a todo whose checked state changed underneath the cached item", () => {
		const lines = ["- [x] ship it", "handles rollback too"];
		const item = { line: 0, lineCount: 2, checked: false, text: "ship it\nhandles rollback too" };
		expect(todoRangeMatches(lines, item)).toBe(false);
	});
});

describe("todoLineMatches / timelineLineMatches", () => {
	it("matches when checked state and text are unchanged", () => {
		const item = { line: 0, lineCount: 1, checked: false, text: "task" };
		expect(todoLineMatches("- [ ] task", item)).toBe(true);
		expect(todoLineMatches("- [x] task", item)).toBe(false); // checked state changed
		expect(todoLineMatches("- [ ] different", item)).toBe(false); // text changed
		expect(todoLineMatches("# _ToDo", item)).toBe(false); // not a checkbox line at all
	});

	it("matches timeline items on start/end/description", () => {
		const item = { line: 0, lineCount: 1, start: "9:00", end: "10:00", description: "work" };
		expect(timelineLineMatches("- 9:00 - 10:00 work", item)).toBe(true);
		expect(timelineLineMatches("- 9:00 - 10:30 work", item)).toBe(false); // end changed
		expect(timelineLineMatches("- 9:00 - 10:00 something else", item)).toBe(false); // description changed
	});

	it("matches on category too, once categories are involved (AGENTS.md 1.4.1)", () => {
		const item = { line: 0, lineCount: 1, start: "9:00", end: "10:00", category: "Work", description: "meeting" };
		expect(timelineLineMatches("- 9:00 - 10:00 [Work] meeting", item)).toBe(true);
		expect(timelineLineMatches("- 9:00 - 10:00 [Study] meeting", item)).toBe(false); // category changed
		expect(timelineLineMatches("- 9:00 - 10:00 meeting", item)).toBe(false); // category dropped entirely
	});

	it("an uncategorized item does not match a line that gained a category", () => {
		const item = { line: 0, lineCount: 1, start: "9:00", end: "10:00", description: "work" };
		expect(timelineLineMatches("- 9:00 - 10:00 [Work] work", item)).toBe(false);
	});
});

describe("timeToMinutes / timelineDurationMinutes", () => {
	it("converts HH:mm to minutes-since-midnight", () => {
		expect(timeToMinutes("9:00")).toBe(540);
		expect(timeToMinutes("00:00")).toBe(0);
		expect(timeToMinutes("23:59")).toBe(1439);
	});

	it("minutesToTime is the inverse of timeToMinutes (zero-padded HH:mm)", () => {
		expect(minutesToTime(540)).toBe("09:00");
		expect(minutesToTime(0)).toBe("00:00");
		expect(minutesToTime(1439)).toBe("23:59");
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
