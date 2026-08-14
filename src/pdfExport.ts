/**
 * Builds a standalone, print-ready HTML snapshot of one day's grid + To-Do
 * list (design.md §13). Pure string-building — no Obsidian API — so it can
 * be unit-tested directly; the caller (TimelineView.tsx) handles writing the
 * result to the vault and opening it.
 */
import { getTextColorForBackground } from "./components/colorUtils";
import { stripHtml, timeToMinutes, type TimelineItem, type TodoItem } from "./parser";
import type { CustomCategory, SidebarTheme } from "./settings";

export interface ExportContext {
	dateHeader: string;
	timeline: TimelineItem[];
	todos: TodoItem[];
	categories: CustomCategory[];
	themeMode: SidebarTheme;
	startHour: number;
	endHour: number;
	uncategorizedLabel: string;
	todayTodosLabel: string;
	printButtonLabel: string;
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => {
		switch (char) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			case "'":
				return "&#39;";
			default:
				return char;
		}
	});
}

const LIGHT_COLORS = {
	backgroundPrimary: "#ffffff",
	backgroundSecondary: "#f8fafc",
	textNormal: "#1e293b",
	textMuted: "#64748b",
	borderColor: "#e2e8f0",
};

const DARK_COLORS = {
	backgroundPrimary: "#1e293b",
	backgroundSecondary: "#0f172a",
	textNormal: "#e2e8f0",
	textMuted: "#94a3b8",
	borderColor: "#334155",
};

export function buildExportHtml(ctx: ExportContext): string {
	const colors = ctx.themeMode === "dark" ? DARK_COLORS : LIGHT_COLORS;
	const hours = Array.from({ length: ctx.endHour - ctx.startHour }, (_, i) => ctx.startHour + i);

	let gridRowsHtml = "";
	for (const hour of hours) {
		const isPm = hour >= 12;
		const displayHour = hour === 0 || hour === 24 ? 12 : hour > 12 ? hour - 12 : hour;
		const ampm = hour === 24 || !isPm ? "AM" : "PM";
		const hourStartMin = hour * 60;
		const hourEndMin = (hour + 1) * 60;

		const overlapping = ctx.timeline.filter((item) => {
			const s = timeToMinutes(item.start);
			const e = timeToMinutes(item.end);
			return Math.max(s, hourStartMin) < Math.min(e, hourEndMin);
		});

		let blocksHtml = "";
		for (const item of overlapping) {
			const s = timeToMinutes(item.start);
			const e = timeToMinutes(item.end);
			const overlapStart = Math.max(s, hourStartMin);
			const overlapEnd = Math.min(e, hourEndMin);
			const leftPercent = ((overlapStart - hourStartMin) / 60) * 100;
			const widthPercent = ((overlapEnd - overlapStart) / 60) * 100;

			const catObj = ctx.categories.find((c) => c.displayName === item.category);
			const bg = catObj?.color ?? "#cbd5e1";
			const label = item.category ?? ctx.uncategorizedLabel;

			blocksHtml += `<div class="grid-block" style="left:${leftPercent}%;width:${widthPercent}%;background:${bg};color:${getTextColorForBackground(bg)};">${escapeHtml(label)}</div>`;
		}

		gridRowsHtml += `
			<div class="grid-row">
				<div class="hour-label">${displayHour} <span class="ampm">${ampm}</span></div>
				<div class="grid-cells">${blocksHtml}</div>
			</div>`;
	}

	const doneCount = ctx.todos.filter((it) => it.checked).length;
	const todosHtml =
		ctx.todos.length === 0
			? ""
			: `
			<div class="todos-block">
				<div class="todos-title">${escapeHtml(ctx.todayTodosLabel)} (${doneCount}/${ctx.todos.length})</div>
				<ul class="todos-list">
					${ctx.todos
						.map(
							(item) =>
								`<li class="${item.checked ? "is-checked" : ""}"><input type="checkbox" disabled ${item.checked ? "checked" : ""}/> <span>${escapeHtml(stripHtml(item.text))}</span></li>`
						)
						.join("")}
				</ul>
			</div>`;

	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(ctx.dateHeader)}</title>
<style>
	body { background: ${colors.backgroundPrimary}; color: ${colors.textNormal}; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; }
	.export-page { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
	.header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 2px solid ${colors.borderColor}; }
	.header h1 { font-size: 1.25em; margin: 0; }
	.print-btn { background: ${colors.backgroundSecondary}; border: 1px solid ${colors.borderColor}; color: ${colors.textNormal}; padding: 6px 14px; border-radius: 6px; cursor: pointer; }
	.grid { border-top: 1px solid ${colors.borderColor}; border-left: 1px solid ${colors.borderColor}; border-radius: 6px; overflow: hidden; }
	.grid-row { display: flex; height: 32px; }
	.hour-label { width: 60px; min-width: 60px; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; font-size: 12px; color: ${colors.textMuted}; border-bottom: 1px solid ${colors.borderColor}; background: ${colors.backgroundSecondary}; box-sizing: border-box; }
	.ampm { font-size: 9px; opacity: 0.7; margin-left: 2px; }
	.grid-cells { flex: 1; position: relative; border-bottom: 1px solid ${colors.borderColor}; box-sizing: border-box; }
	.grid-block { position: absolute; top: 3px; height: calc(100% - 6px); border-radius: 4px; font-size: 11px; font-weight: 600; display: flex; align-items: center; padding: 0 6px; overflow: hidden; white-space: nowrap; box-sizing: border-box; }
	.todos-block { border: 1px solid ${colors.borderColor}; border-radius: 6px; padding: 12px 16px; }
	.todos-title { font-weight: 600; margin-bottom: 8px; }
	.todos-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
	.todos-list li.is-checked span { text-decoration: line-through; color: ${colors.textMuted}; }
	@media print { .print-btn { display: none; } body { padding: 0; } }
</style>
</head>
<body>
	<div class="export-page">
		<div class="header">
			<h1>${escapeHtml(ctx.dateHeader)}</h1>
			<button class="print-btn" onclick="window.print()">${escapeHtml(ctx.printButtonLabel)}</button>
		</div>
		<div class="grid">${gridRowsHtml}</div>
		${todosHtml}
	</div>
</body>
</html>`;
}
