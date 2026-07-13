import { App, PluginSettingTab, Setting } from "obsidian";
import type DailyWorkLogPlugin from "./main";
import type { MarkerLanguage } from "./parser";
import type { SidebarTheme } from "./settings";

export class DailyWorkLogSettingTab extends PluginSettingTab {
	private readonly plugin: DailyWorkLogPlugin;

	constructor(app: App, plugin: DailyWorkLogPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("마커 언어 (Marker language)")
			.setDesc(
				"새 일일 노트를 생성할 때 삽입되는 _Event/_ToDo/_Diary 마커의 표시 언어입니다. " +
					"언어를 바꿔도 기존 파일에 쓰인 다른 언어 마커는 계속 인식됩니다."
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("en", "영어")
					.addOption("ko", "한국어")
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language = value as MarkerLanguage;
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					})
			);

		new Setting(containerEl)
			.setName("사이드바 테마")
			.setDesc(
				"사이드바 자체의 색상 테마입니다. Obsidian 전체 테마와는 별개로 동작합니다 " +
					"(팝업/모달은 항상 시스템 테마를 따릅니다)."
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("light", "라이트")
					.addOption("dark", "다크")
					.setValue(this.plugin.settings.theme)
					.onChange(async (value) => {
						this.plugin.settings.theme = value as SidebarTheme;
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					})
			);
	}
}
