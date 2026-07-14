import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import type DailyWorkLogPlugin from "./main";
import { parseDailyNote, type MarkerLanguage, type ParsedDailyNote } from "./parser";
import { formatDateBasename, parseDateFromBasename } from "./dailyNote";
import { computeDashboardStats, getRecentWindowStart, type DashboardStats } from "./dashboardCollector";
import { t } from "./i18n";

export const VIEW_TYPE_DASHBOARD = "dwl-dashboard";

interface DailyNoteFile {
	file: TFile;
	date: Date;
}

/**
 * Central "Dashboard" panel — a vault-wide summary of daily notes, opened
 * as a normal tab in the main workspace area (not the right sidebar).
 * Unlike the sidebar view, this has NO manual light/dark setting: it just
 * follows Obsidian's own theme variables (see AGENTS.md 2. Settings).
 */
export class DashboardView extends ItemView {
	private readonly plugin: DailyWorkLogPlugin;
	// Same re-entrancy guard as DailyWorkLogView.refresh() — see AGENTS.md 3.
	private refreshToken = 0;

	constructor(leaf: WorkspaceLeaf, plugin: DailyWorkLogPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_DASHBOARD;
	}

	getDisplayText(): string {
		return t("dashboardTitle", this.plugin.settings.language);
	}

	getIcon(): string {
		return "calendar-clock";
	}

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	onClose(): Promise<void> {
		return Promise.resolve();
	}

	async refresh(): Promise<void> {
		const token = ++this.refreshToken;
		const language = this.plugin.settings.language;

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("dwl-dashboard-view");

		const header = container.createDiv({ cls: "dwl-dashboard-header" });
		header.createEl("h2", { cls: "dwl-dashboard-title", text: t("dashboardTitle", language) });
		const refreshBtn = header.createEl("button", {
			cls: "dwl-dashboard-refresh-btn",
			text: t("btnRefresh", language),
		});
		refreshBtn.addEventListener("click", () => void this.refresh());

		const today = new Date();
		const allNotes = this.collectDailyNoteFiles();

		if (allNotes.length === 0) {
			container.createDiv({ cls: "dwl-empty-state", text: t("dashboardEmptyVault", language) });
			return;
		}

		const windowStart = getRecentWindowStart(today);
		const recentNotes = allNotes
			.filter((note) => note.date >= windowStart)
			.sort((a, b) => b.date.getTime() - a.date.getTime());

		const recentParsed: Array<{ date: Date; parsed: ParsedDailyNote }> = [];
		for (const note of recentNotes) {
			const content = await this.app.vault.cachedRead(note.file);
			recentParsed.push({ date: note.date, parsed: parseDailyNote(content) });
		}

		if (token !== this.refreshToken) return; // superseded by a newer refresh() call meanwhile

		const stats = computeDashboardStats(
			allNotes.map((note) => note.date),
			recentParsed,
			today
		);

		this.renderStats(container, stats, language);
		this.renderRecentNotesList(container, recentNotes, language);
	}

	/** Filename-derived only (no file reads) — cheap even for large/long-running vaults. */
	private collectDailyNoteFiles(): DailyNoteFile[] {
		const result: DailyNoteFile[] = [];
		for (const file of this.app.vault.getFiles()) {
			if (file.extension !== "md") continue;
			const date = parseDateFromBasename(file.basename);
			if (date) result.push({ file, date });
		}
		return result;
	}

	private renderStats(container: HTMLElement, stats: DashboardStats, language: MarkerLanguage): void {
		const grid = container.createDiv({ cls: "dwl-dashboard-stats" });

		this.renderStatCard(grid, t("statTotalNotes", language), String(stats.totalNotes));
		this.renderStatCard(grid, t("statStreak", language), `${stats.currentStreak}${t("unitDays", language)}`);

		const dateRangeText =
			stats.oldestDate && stats.newestDate
				? `${formatDateBasename(stats.oldestDate)} ~ ${formatDateBasename(stats.newestDate)}`
				: "-";
		this.renderStatCard(grid, t("statDateRange", language), dateRangeText);

		const todoRateText =
			stats.recentTodoTotal > 0
				? `${stats.recentTodoCompleted}/${stats.recentTodoTotal} (${Math.round(
						(stats.recentTodoCompleted / stats.recentTodoTotal) * 100
					)}%)`
				: "-";
		this.renderStatCard(grid, t("statTodoRate", language), todoRateText);

		this.renderStatCard(grid, t("statEventTime", language), formatMinutes(stats.recentEventMinutes));
	}

	private renderStatCard(container: HTMLElement, label: string, value: string): void {
		const card = container.createDiv({ cls: "dwl-dashboard-stat-card" });
		card.createDiv({ cls: "dwl-dashboard-stat-label", text: label });
		card.createDiv({ cls: "dwl-dashboard-stat-value", text: value });
	}

	private renderRecentNotesList(container: HTMLElement, recentNotes: DailyNoteFile[], language: MarkerLanguage): void {
		container.createEl("h3", { cls: "dwl-dashboard-subtitle", text: t("recentNotesTitle", language) });
		const list = container.createDiv({ cls: "dwl-dashboard-note-list" });

		for (const note of recentNotes) {
			const row = list.createDiv({ cls: "dwl-dashboard-note-item", text: formatDateBasename(note.date) });
			row.addEventListener("click", () => {
				void this.app.workspace.openLinkText(note.file.path, "", false);
			});
		}
	}
}

function formatMinutes(totalMinutes: number): string {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours}h ${minutes}m`;
}
