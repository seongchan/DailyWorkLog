import type { MarkerLanguage } from "./parser";

/**
 * Sidebar-only color scheme, independent of Obsidian's own active theme.
 * Modals intentionally do NOT use this — they always follow the SYSTEM
 * theme (Canvas/CanvasText, design.md §3), and the (not-yet-built) central
 * Dashboard view also doesn't use this — it just follows Obsidian's own
 * theme variables. Only the sidebar view is manually switchable.
 */
export type SidebarTheme = "light" | "dark";

export interface DailyWorkLogSettings {
	/**
	 * Only controls which label is inserted into newly scaffolded notes
	 * (see dailyNote.ts buildSkeletonContent). Parsing always recognizes
	 * every supported language's marker labels regardless of this setting.
	 */
	language: MarkerLanguage;
	/** Sidebar color scheme. The mockup (docs/sidebar-mockup.html) is "light". */
	theme: SidebarTheme;
}

export const DEFAULT_SETTINGS: DailyWorkLogSettings = {
	language: "en",
	theme: "light",
};
