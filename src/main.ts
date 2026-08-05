import { getLanguage, Plugin, setTooltip, TFile } from "obsidian";
import { DailyWorkLogView, VIEW_TYPE_DAILY_WORK_LOG } from "./view";
import { DashboardView, VIEW_TYPE_DASHBOARD } from "./DashboardView";
import { t } from "./i18n";
import { DailyWorkLogSettingTab } from "./SettingTab";
import { DEFAULT_SETTINGS, migrateLoadedSettings, type DailyWorkLogSettings, type SidebarTheme } from "./settings";

export default class DailyWorkLogPlugin extends Plugin {
	settings: DailyWorkLogSettings = DEFAULT_SETTINGS;
	private lastSelfWrite: { path: string; content: string } | null = null;
	private sidebarRibbonEl!: HTMLElement;
	private dashboardRibbonEl!: HTMLElement;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new DailyWorkLogSettingTab(this.app, this));

		this.registerView(VIEW_TYPE_DAILY_WORK_LOG, (leaf) => new DailyWorkLogView(leaf, this));
		this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));

		this.dashboardRibbonEl = this.addRibbonIcon("gauge", t("ribbonOpenDashboard", this.settings.language), () => {
			void this.activateDashboard();
		});

		this.sidebarRibbonEl = this.addRibbonIcon("calendar-clock", t("ribbonOpenSidebar", this.settings.language), () => {
			void this.activateView();
		});

		// Command names, unlike the ribbon tooltips above, have no supported
		// live-update API (no setTooltip equivalent) — they're set once here
		// at startup language and won't change until Obsidian restarts, even
		// if the user flips the language setting mid-session.
		this.addCommand({
			id: "open-sidebar",
			name: t("commandOpenSidebar", this.settings.language),
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "open-dashboard",
			name: t("commandOpenDashboard", this.settings.language),
			callback: () => void this.activateDashboard(),
		});

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.refreshViews();
			})
		);

		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				void this.handleVaultModify(file);
			})
		);
	}

	async loadSettings(): Promise<void> {
		const loadedData = (await this.loadData()) as (Partial<DailyWorkLogSettings> & { theme?: SidebarTheme }) | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, migrateLoadedSettings(loadedData));

		// First run only (no saved language yet) — auto-detect from Obsidian's own UI
		// language, then persist it so this never re-triggers. Purely a nicer default;
		// the dropdown in SettingTab can always override it afterward (AGENTS.md §2).
		if (!loadedData || loadedData.language === undefined) {
			this.settings.language = getLanguage() === "ko" ? "ko" : "en";
			await this.saveSettings();
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Writes must go through this method (not `vault.modify` directly) so the
	 * resulting `modify` event can be recognized as self-triggered and
	 * skipped — otherwise the sidebar would redundantly re-render itself
	 * every time it edits a To-Do checkbox (AGENTS.md 2. Event Listeners).
	 */
	async writeFile(file: TFile, content: string): Promise<void> {
		this.lastSelfWrite = { path: file.path, content };
		await this.app.vault.modify(file, content);
	}

	private async handleVaultModify(file: unknown): Promise<void> {
		if (!(file instanceof TFile) || file.extension !== "md") return;
		if (await this.isSelfTriggeredWrite(file)) return;
		this.refreshViews();
	}

	private async isSelfTriggeredWrite(file: TFile): Promise<boolean> {
		if (!this.lastSelfWrite || this.lastSelfWrite.path !== file.path) return false;
		const content = await this.app.vault.read(file);
		if (content === this.lastSelfWrite.content) {
			this.lastSelfWrite = null;
			return true;
		}
		return false;
	}

	/** Public so SettingTab can force a re-render (e.g. after a language/theme change). */
	refreshViews(): void {
		setTooltip(this.sidebarRibbonEl, t("ribbonOpenSidebar", this.settings.language));
		setTooltip(this.dashboardRibbonEl, t("ribbonOpenDashboard", this.settings.language));

		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_WORK_LOG)) {
			if (leaf.view instanceof DailyWorkLogView) {
				void leaf.view.refresh();
			}
		}
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)) {
			if (leaf.view instanceof DashboardView) {
				void leaf.view.refresh();
			}
		}
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_DAILY_WORK_LOG)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (!rightLeaf) return;
			leaf = rightLeaf;
			await leaf.setViewState({ type: VIEW_TYPE_DAILY_WORK_LOG, active: true });
		}

		void workspace.revealLeaf(leaf);
	}

	/** Opens the Dashboard as a normal tab in the main workspace area (not the sidebar). */
	async activateDashboard(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)[0];

		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
		}

		void workspace.revealLeaf(leaf);
	}
}
