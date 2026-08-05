import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { FolderSuggest } from "./FolderSuggest";
import { t } from "./i18n";
import type DailyWorkLogPlugin from "./main";
import type { MarkerLanguage } from "./parser";
import { DEFAULT_CATEGORIES, type SidebarTheme } from "./settings";

const MAX_CATEGORIES = 10;
const MAX_CATEGORY_NAME_LENGTH = 10;

/**
 * DayTime Tracker-parity settings surface (AGENTS.md §2, design.md §14):
 * general (hour range / folder / language), theme, and category management.
 * Every label goes through i18n.ts (t()) exactly like the sidebar/modal —
 * this tab used to be hardcoded Korean regardless of the language setting,
 * which was an oversight, not a deliberate exception.
 * Still uses the imperative `display()` API rather than the declarative
 * `getSettingDefinitions()` (Obsidian 1.13.0+) — see AGENTS.md §2 for why
 * that trade-off is intentional here.
 */
export class DailyWorkLogSettingTab extends PluginSettingTab {
	private readonly plugin: DailyWorkLogPlugin;

	constructor(app: App, plugin: DailyWorkLogPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const lang = this.plugin.settings.language;

		new Setting(containerEl).setName(t("settingsTitle", lang)).setHeading();
		new Setting(containerEl).setName(t("settingGeneralSection", lang)).setHeading();

		new Setting(containerEl)
			.setName(t("settingStartHourName", lang))
			.setDesc(t("settingStartHourDesc", lang))
			.addDropdown((dropdown) => {
				for (let h = 0; h <= 23; h++) {
					dropdown.addOption(String(h), formatHourOption(h, lang));
				}
				dropdown.setValue(String(this.plugin.settings.startHour)).onChange(async (value) => {
					const hour = parseInt(value, 10);
					if (hour >= this.plugin.settings.endHour) {
						new Notice(t("alertStartBeforeEnd", lang));
						dropdown.setValue(String(this.plugin.settings.startHour));
						return;
					}
					this.plugin.settings.startHour = hour;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				});
			});

		new Setting(containerEl)
			.setName(t("settingEndHourName", lang))
			.setDesc(t("settingEndHourDesc", lang))
			.addDropdown((dropdown) => {
				for (let h = 1; h <= 24; h++) {
					dropdown.addOption(String(h), formatHourOption(h, lang));
				}
				dropdown.setValue(String(this.plugin.settings.endHour)).onChange(async (value) => {
					const hour = parseInt(value, 10);
					if (hour <= this.plugin.settings.startHour) {
						new Notice(t("alertEndAfterStart", lang));
						dropdown.setValue(String(this.plugin.settings.endHour));
						return;
					}
					this.plugin.settings.endHour = hour;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				});
			});

		new Setting(containerEl)
			.setName(t("settingFolderName", lang))
			.setDesc(t("settingFolderDesc", lang))
			.addText((text) => {
				text
					.setPlaceholder(t("settingFolderPlaceholder", lang))
					.setValue(this.plugin.settings.dailyNoteFolder)
					.onChange(async (value) => {
						this.plugin.settings.dailyNoteFolder = value.trim();
						await this.plugin.saveSettings();
					});
				new FolderSuggest(this.app, text.inputEl);
			});

		new Setting(containerEl)
			.setName(t("settingLanguageName", lang))
			.setDesc(t("settingLanguageDesc", lang))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("en", "English")
					.addOption("ko", "한국어")
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language = value as MarkerLanguage;
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName(t("settingThemeModeName", lang))
			.setDesc(t("settingThemeModeDesc", lang))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("light", t("themeModeLight", lang))
					.addOption("dark", t("themeModeDark", lang))
					.setValue(this.plugin.settings.themeMode)
					.onChange(async (value) => {
						this.plugin.settings.themeMode = value as SidebarTheme;
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					})
			);

		this.renderCategorySection(containerEl, lang);
	}

	private renderCategorySection(containerEl: HTMLElement, lang: MarkerLanguage): void {
		new Setting(containerEl).setName(t("settingCategoriesSection", lang)).setHeading();
		containerEl.createEl("p", {
			text: t("settingCategoriesDesc", lang),
			cls: "dwl-category-section-desc",
		});

		new Setting(containerEl)
			.setName(t("settingResetCategoriesName", lang))
			.setDesc(t("settingResetCategoriesDesc", lang))
			.addButton((btn) => {
				btn
					.setButtonText(t("btnReset", lang))
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.categories = [...DEFAULT_CATEGORIES];
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
						new Notice(t("noticeResetCategories", lang));
						this.display();
					});
			});

		const categories = this.plugin.settings.categories;
		categories.forEach((cat, idx) => {
			const row = new Setting(containerEl).setName("");
			row.settingEl.addClass("dwl-category-setting-item");

			row.addText((text) => {
				text
					.setPlaceholder(t("settingCatDisplayNamePlaceholder", lang))
					.setValue(cat.displayName)
					.onChange(async (value) => {
						const trimmed = value.trim();
						categories[idx].displayName = trimmed;
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					});
				text.inputEl.maxLength = MAX_CATEGORY_NAME_LENGTH;
			});

			row.addColorPicker((picker) => {
				picker.setValue(cat.color).onChange(async (value) => {
					categories[idx].color = value;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				});
			});

			if (!cat.isDefault) {
				row.addButton((btn) => {
					btn
						.setButtonText("✕")
						.setWarning()
						.onClick(async () => {
							categories.splice(idx, 1);
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
							this.display();
						});
				});
			}
		});

		if (categories.length < MAX_CATEGORIES) {
			let newName = "";
			let newColor = "#95a5a6";

			new Setting(containerEl)
				.setName(t("settingAddCategoryName", lang))
				.setDesc(t("settingAddCategoryDesc", lang))
				.addText((text) => {
					text.setPlaceholder(t("settingAddCategoryPlaceholder", lang)).onChange((value) => {
						newName = value;
					});
					text.inputEl.maxLength = MAX_CATEGORY_NAME_LENGTH;
				})
				.addColorPicker((picker) => {
					picker.setValue(newColor).onChange((value) => {
						newColor = value;
					});
				})
				.addButton((btn) => {
					btn
						.setButtonText(t("btnAdd", lang))
						.setCta()
						.onClick(async () => {
							const trimmed = newName.trim();
							if (!trimmed) {
								new Notice(t("alertCatNameEmpty", lang));
								return;
							}
							if (categories.length >= MAX_CATEGORIES) {
								new Notice(t("alertCatLimitMax", lang));
								return;
							}
							const exists = categories.some((c) => c.displayName.toLowerCase() === trimmed.toLowerCase());
							if (exists) {
								new Notice(t("alertCatNameExists", lang));
								return;
							}

							categories.push({ name: trimmed, displayName: trimmed, color: newColor });
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
							this.display();
						});
				});
		}
	}
}

function formatHourOption(hour: number, lang: MarkerLanguage): string {
	if (hour === 0) return lang === "ko" ? "오전 12시 (00:00)" : "12 AM (00:00)";
	if (hour === 24) return lang === "ko" ? "자정 (24:00)" : "Midnight (24:00)";
	if (hour === 12) return lang === "ko" ? "오후 12시 (12:00)" : "12 PM (12:00)";
	if (hour < 12) return lang === "ko" ? `오전 ${hour}시` : `${hour} AM`;
	return lang === "ko" ? `오후 ${hour - 12}시` : `${hour - 12} PM`;
}
