import { describe, expect, it } from "vitest";
import { buildExportHtml } from "./pdfExport";

const baseCtx = {
	dateHeader: "2026-08-05 (Wed)",
	timeline: [],
	todos: [],
	categories: [{ name: "Work", displayName: "Work", color: "#d0e1fd", isDefault: true }],
	themeMode: "light" as const,
	startHour: 0,
	endHour: 24,
	uncategorizedLabel: "Uncategorized",
	todayTodosLabel: "Today's To-Dos",
	printButtonLabel: "Save as PDF / Print",
};

describe("buildExportHtml", () => {
	it("includes the date header and print button label", () => {
		const html = buildExportHtml(baseCtx);
		expect(html).toContain("2026-08-05 (Wed)");
		expect(html).toContain("Save as PDF / Print");
	});

	it("renders a labeled block for a timeline item with a matching category color", () => {
		const html = buildExportHtml({
			...baseCtx,
			timeline: [{ line: 0, lineCount: 1, start: "09:00", end: "10:00", category: "Work", description: "meeting" }],
		});
		expect(html).toContain("#d0e1fd");
		expect(html).toContain("Work");
	});

	it("falls back to the uncategorized label when a timeline item has no category", () => {
		const html = buildExportHtml({
			...baseCtx,
			timeline: [{ line: 0, lineCount: 1, start: "09:00", end: "10:00", description: "meeting" }],
		});
		expect(html).toContain("Uncategorized");
	});

	it("strips HTML tags from To-Do text instead of injecting them raw", () => {
		const html = buildExportHtml({
			...baseCtx,
			todos: [{ line: 0, lineCount: 1, checked: false, text: "<script>alert(1)</script>" }],
		});
		expect(html).not.toContain("<script>alert(1)</script>");
		expect(html).not.toContain("<script>");
		expect(html).toContain("<span>alert(1)</span>");
	});

	it("omits the to-dos block markup entirely when there are no todos", () => {
		const html = buildExportHtml(baseCtx);
		expect(html).not.toContain('class="todos-block"');
	});
});
