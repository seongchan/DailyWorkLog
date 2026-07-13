import { Plugin, TFile } from "obsidian";
import { DailyWorkLogView, VIEW_TYPE_DAILY_WORK_LOG } from "./view";
import { DashboardView, VIEW_TYPE_DASHBOARD } from "./DashboardView";
import { DailyWorkLogSettingTab } from "./SettingTab";
import { DEFAULT_SETTINGS, type DailyWorkLogSettings } from "./settings";

export default class DailyWorkLogPlugin extends Plugin {
	settings: DailyWorkLogSettings = DEFAULT_SETTINGS;
	private lastSelfWrite: { path: string; content: string } | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new DailyWorkLogSettingTab(this.app, this));

		this.registerView(VIEW_TYPE_DAILY_WORK_LOG, (leaf) => new DailyWorkLogView(leaf, this));
		this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));

		this.addRibbonIcon("calendar-clock", "Daily Work Log 대시보드 열기", () => {
			void this.activateDashboard();
		});

		this.addCommand({
			id: "open-daily-work-log-view",
			name: "Daily Work Log 사이드바 열기",
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "open-daily-work-log-dashboard",
			name: "Daily Work Log 대시보드 열기",
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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

		workspace.revealLeaf(leaf);
	}

	/** Opens the Dashboard as a normal tab in the main workspace area (not the sidebar). */
	async activateDashboard(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)[0];

		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
		}

		workspace.revealLeaf(leaf);
	}
}
