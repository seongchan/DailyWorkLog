import { ItemView, TFile, Vault, type TAbstractFile, type WorkspaceLeaf } from "obsidian";
import type DailyWorkLogPlugin from "./main";
import { parseDailyNote, type MarkerLanguage, type ParsedDailyNote } from "./parser";
import { formatDateBasename, isInDailyNoteFolder, parseDateFromBasename } from "./dailyNote";
import { computeDashboardStats, getRecentWindowStart, type DashboardStats } from "./dashboardCollector";
import { getTextColorForBackground } from "./components/colorUtils";
import { t } from "./i18n";

export const VIEW_TYPE_DASHBOARD = "dwl-dashboard";

interface DailyNoteFile {
	file: TFile;
	date: Date;
}

/**
 * Central "Dashboard" panel — a vault-wide summary of daily notes, opened
 * as a normal tab in the main workspace area (not the right sidebar).
 * Follows Obsidian's own theme variables (see AGENTS.md 2. Settings).
 */
export class DashboardView extends ItemView {
	private readonly plugin: DailyWorkLogPlugin;
	// Same re-entrancy guard as DailyWorkLogView.refresh() — see AGENTS.md 3.
	private refreshToken = 0;
	private selectedWindowDays = 30; // 7, 30, 90, 0 (all)

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
		return "gauge";
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

		const allNotes = this.collectDailyNoteFiles();

		// Header area with Title & Window Dropdown
		this.renderHeader(container, language);

		if (allNotes.length === 0) {
			container.createDiv({ cls: "dwl-dashboard-empty", text: t("dashboardEmptyVault", language) });
			return;
		}

		const today = new Date();
		const windowStart = getRecentWindowStart(today, this.selectedWindowDays);
		const recentNotes = allNotes
			.filter((note) => note.date >= windowStart)
			.sort((a, b) => b.date.getTime() - a.date.getTime());

		// Read in parallel rather than one file at a time — "All Time" can mean
		// every daily note in the vault, and cachedRead() calls don't depend on
		// each other, so there's no reason to serialize them.
		const recentParsed: Array<{ date: Date; parsed: ParsedDailyNote }> = await Promise.all(
			recentNotes.map(async (note) => ({
				date: note.date,
				parsed: parseDailyNote(await this.app.vault.cachedRead(note.file)),
			}))
		);

		if (token !== this.refreshToken) return; // superseded by a newer refresh() call meanwhile

		const uncategorizedLabel = t("uncategorized", language);
		const stats = computeDashboardStats(
			allNotes.map((note) => note.date),
			recentParsed,
			today,
			this.plugin.settings.categories,
			uncategorizedLabel
		);

		// KPI Grid
		this.renderKpiGrid(container, stats, language);

		// Category Distribution Bar
		this.renderCategoryDistribution(container, stats, language);

		// Bottom 2-Column Layout (Recent Activity + Summary)
		this.renderBottomLayout(container, stats, recentNotes, language);
	}

	/**
	 * Collects daily note files filtered strictly by dailyNoteFolder setting
	 * (AGENTS.md 1.1 + User Request).
	 */
	private collectDailyNoteFiles(): DailyNoteFile[] {
		const result: DailyNoteFile[] = [];
		const folderSetting = this.plugin.settings.dailyNoteFolder;
		const normalizedFolder = folderSetting.trim().replace(/^\/+|\/+$/g, "");

		const consider = (file: TAbstractFile) => {
			if (!(file instanceof TFile) || file.extension !== "md") return;
			if (!isInDailyNoteFolder(file.path, folderSetting)) return;
			const date = parseDateFromBasename(file.basename);
			if (date) result.push({ file, date });
		};

		// Scoped to the configured folder when one is set, so large vaults
		// aren't walked in full just to find daily notes in a subfolder. Falls
		// back to a vault-wide scan when unset (fresh install default) or when
		// the configured folder doesn't currently exist.
		const scopedFolder = normalizedFolder ? this.app.vault.getFolderByPath(normalizedFolder) : null;
		if (scopedFolder) {
			Vault.recurseChildren(scopedFolder, consider);
		} else {
			this.app.vault.getFiles().forEach(consider);
		}
		return result;
	}

	private renderHeader(container: HTMLElement, language: MarkerLanguage): void {
		const header = container.createDiv({ cls: "dwl-dashboard-header" });
		const titleArea = header.createDiv({ cls: "dwl-dashboard-title-area" });
		titleArea.createEl("h2", { cls: "dwl-dashboard-title", text: t("dashboardTitle", language) });

		const controls = header.createDiv({ cls: "dwl-dashboard-controls" });


		// Window selector dropdown
		const select = controls.createEl("select", { cls: "dwl-dashboard-select" });
		const options: Array<{ label: string; value: number }> = [
			{ label: t("window7Days", language), value: 7 },
			{ label: t("window30Days", language), value: 30 },
			{ label: t("window90Days", language), value: 90 },
			{ label: t("windowAllTime", language), value: 0 },
		];

		for (const opt of options) {
			const el = select.createEl("option", { text: opt.label, value: String(opt.value) });
			if (opt.value === this.selectedWindowDays) el.selected = true;
		}

		select.addEventListener("change", (e) => {
			const target = e.target as HTMLSelectElement;
			this.selectedWindowDays = Number(target.value);
			void this.refresh();
		});

		// Refresh Button
		const refreshBtn = controls.createEl("button", {
			cls: "dwl-dashboard-refresh-btn",
			text: t("btnRefresh", language),
		});
		refreshBtn.addEventListener("click", () => void this.refresh());
	}

	private renderKpiGrid(container: HTMLElement, stats: DashboardStats, language: MarkerLanguage): void {
		const grid = container.createDiv({ cls: "dwl-dashboard-kpi-grid" });

		const workCat = this.plugin.settings.categories.find(
			(c) => c.name === "Work" || c.displayName.toLowerCase() === "work" || c.displayName === "업무"
		);
		const workColor = workCat ? workCat.color : "#d0e1fd";

		// Card 1: Total Notes & Streak
		const streakBadge = stats.currentStreak > 0 ? `${stats.currentStreak}${t("unitDays", language)}` : "";
		this.renderMetricCard(
			grid,
			t("statTotalNotes", language),
			String(stats.totalNotes),
			`${t("statStreak", language)}: ${stats.currentStreak}${t("unitDays", language)}`,
			streakBadge,
			workColor
		);

		// Card 2: To-Do Completion Rate
		const todoPct =
			stats.recentTodoTotal > 0
				? `${Math.round((stats.recentTodoCompleted / stats.recentTodoTotal) * 100)}%`
				: "-";
		const todoSub =
			stats.recentTodoTotal > 0
				? `${stats.recentTodoCompleted} / ${stats.recentTodoTotal}`
				: t("emptyTodo", language);
		this.renderMetricCard(grid, t("statTodoRate", language), todoPct, todoSub);

		// Card 3: Event Recording Time & Daily Average
		const timeVal = formatMinutes(stats.recentEventMinutes);
		const avgSub = `${t("statAvgPerDay", language)}: ${formatMinutes(stats.avgEventMinutesPerDay)}`;
		this.renderMetricCard(grid, t("statEventTime", language), timeVal, avgSub);

		// Card 4: Top Category
		const topCat = stats.topCategoryName ?? "-";
		const topCatSub =
			stats.categoryBreakdown.length > 0
				? t("statTopCategoryPct", language).replace("%s", String(stats.categoryBreakdown[0].percentage))
				: "-";
		this.renderMetricCard(grid, t("statTopCategory", language), topCat, topCatSub);
	}

	private renderMetricCard(
		container: HTMLElement,
		label: string,
		value: string,
		footerText: string,
		badgeText?: string,
		badgeBgColor?: string
	): void {
		const card = container.createDiv({ cls: "dwl-dashboard-kpi-card" });
		const topRow = card.createDiv({ cls: "dwl-kpi-top-row" });
		topRow.createDiv({ cls: "dwl-kpi-label", text: label });

		if (badgeText) {
			const badge = topRow.createDiv({ cls: "dwl-kpi-badge", text: badgeText });
			if (badgeBgColor) {
				badge.setCssStyles({ backgroundColor: badgeBgColor, color: "#0f172a" });
			}
		}

		card.createDiv({ cls: "dwl-kpi-value", text: value });
		card.createDiv({ cls: "dwl-kpi-footer", text: footerText });
	}


	private renderCategoryDistribution(container: HTMLElement, stats: DashboardStats, language: MarkerLanguage): void {
		const card = container.createDiv({ cls: "dwl-dashboard-card dwl-dashboard-distribution-card" });
		card.createDiv({ cls: "dwl-dashboard-card-title", text: t("categoryDistTitle", language) });

		if (stats.categoryBreakdown.length === 0) {
			card.createDiv({ cls: "dwl-dashboard-card-empty", text: "-" });
			return;
		}

		// Multi-segment progress bar
		const bar = card.createDiv({ cls: "dwl-dashboard-multi-progress" });
		for (const item of stats.categoryBreakdown) {
			if (item.percentage <= 0) continue;
			const seg = bar.createDiv({ cls: "dwl-dashboard-progress-segment" });
			seg.setCssStyles({ width: `${item.percentage}%`, backgroundColor: item.color });
			seg.setAttribute("title", `${item.displayName}: ${formatMinutes(item.minutes)} (${item.percentage}%)`);
		}

		// Legend grid
		const legend = card.createDiv({ cls: "dwl-dashboard-legend-grid" });
		for (const item of stats.categoryBreakdown) {
			const itemEl = legend.createDiv({ cls: "dwl-dashboard-legend-item" });
			const labelRow = itemEl.createDiv({ cls: "dwl-legend-label-row" });

			const dot = labelRow.createSpan({ cls: "dwl-legend-dot" });
			dot.setCssStyles({ backgroundColor: item.color });
			labelRow.createSpan({ cls: "dwl-legend-name", text: item.displayName });

			const valRow = itemEl.createDiv({ cls: "dwl-legend-val-row" });
			valRow.createSpan({ cls: "dwl-legend-time", text: formatMinutes(item.minutes) });
			valRow.createSpan({ cls: "dwl-legend-pct", text: `${item.percentage}%` });
		}
	}

	private renderBottomLayout(
		container: HTMLElement,
		stats: DashboardStats,
		recentNotes: DailyNoteFile[],
		language: MarkerLanguage
	): void {
		const layout = container.createDiv({ cls: "dwl-dashboard-bottom-layout" });

		// Left Panel: Recent Note Activities
		const leftPanel = layout.createDiv({ cls: "dwl-dashboard-panel dwl-panel-left" });
		leftPanel.createDiv({ cls: "dwl-dashboard-panel-title", text: t("activityNotesTitle", language) });

		const activityList = leftPanel.createDiv({ cls: "dwl-dashboard-activity-list" });
		const noteSummaries = stats.recentNotesSummary;

		if (noteSummaries.length === 0) {
			activityList.createDiv({ cls: "dwl-dashboard-card-empty", text: t("dashboardEmptyVault", language) });
		} else {
			for (let i = 0; i < Math.min(10, noteSummaries.length); i++) {
				const summary = noteSummaries[i];
				const noteFile = recentNotes[i];
				if (!noteFile) continue;

				const row = activityList.createDiv({ cls: "dwl-dashboard-activity-row" });

				// Left: Date
				row.createDiv({ cls: "dwl-activity-date", text: formatDateBasename(summary.date) });

				// Middle: Category Badge & To-Do Progress
				const mid = row.createDiv({ cls: "dwl-activity-mid" });
				if (summary.topCategory) {
					// Exact match, same as the categoryBreakdown lookup in
					// dashboardCollector.ts — summary.topCategory is always either a
					// configured category's displayName or the uncategorized label.
					const catObj = this.plugin.settings.categories.find((c) => c.displayName === summary.topCategory);
					const badge = mid.createSpan({ cls: "dwl-activity-cat-badge", text: summary.topCategory });
					if (catObj) {
						badge.setCssStyles({
							backgroundColor: catObj.color,
							color: getTextColorForBackground(catObj.color),
						});
					}
				}

				if (summary.todoTotal > 0) {
					const pct = Math.round((summary.todoCompleted / summary.todoTotal) * 100);
					mid.createSpan({
						cls: "dwl-activity-todo-text",
						text: `To-Do ${summary.todoCompleted}/${summary.todoTotal} (${pct}%)`,
					});
				}

				// Right: Time
				row.createDiv({
					cls: "dwl-activity-time",
					text: summary.eventMinutes > 0 ? formatMinutes(summary.eventMinutes) : "-",
				});

				row.addEventListener("click", () => {
					void this.app.workspace.openLinkText(noteFile.file.path, "", false);
				});
			}
		}

		// Right Panel: Period Summary
		const rightPanel = layout.createDiv({ cls: "dwl-dashboard-panel dwl-panel-right" });
		rightPanel.createDiv({ cls: "dwl-dashboard-panel-title", text: t("periodSummaryTitle", language) });

		const summaryBox = rightPanel.createDiv({ cls: "dwl-dashboard-summary-box" });

		const dateRangeText =
			stats.oldestDate && stats.newestDate
				? `${formatDateBasename(stats.oldestDate)} ~ ${formatDateBasename(stats.newestDate)}`
				: "-";

		this.renderSummaryRow(summaryBox, t("statDateRange", language), dateRangeText);
		this.renderSummaryRow(summaryBox, t("statStreak", language), `${stats.currentStreak} ${t("unitDays", language)}`);
		this.renderSummaryRow(
			summaryBox,
			t("statTodoRate", language),
			stats.recentTodoTotal > 0
				? `${stats.recentTodoCompleted} / ${stats.recentTodoTotal} (${Math.round(
						(stats.recentTodoCompleted / stats.recentTodoTotal) * 100
				  )}%)`
				: "-"
		);
		this.renderSummaryRow(summaryBox, t("statEventTime", language), formatMinutes(stats.recentEventMinutes));
		this.renderSummaryRow(summaryBox, t("statAvgPerDay", language), formatMinutes(stats.avgEventMinutesPerDay));
	}

	private renderSummaryRow(container: HTMLElement, label: string, value: string): void {
		const row = container.createDiv({ cls: "dwl-summary-row" });
		row.createDiv({ cls: "dwl-summary-label", text: label });
		row.createDiv({ cls: "dwl-summary-val", text: value });
	}
}

function formatMinutes(totalMinutes: number): string {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours === 0) return `${minutes}m`;
	if (minutes === 0) return `${hours}h`;
	return `${hours}h ${minutes}m`;
}
