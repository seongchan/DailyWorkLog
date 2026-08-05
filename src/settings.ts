import type { MarkerLanguage } from "./parser";

/**
 * Sidebar-only color scheme, independent of Obsidian's own active theme.
 * Modals intentionally do NOT use this — they always follow the SYSTEM
 * theme (Canvas/CanvasText, design.md §3), and the Dashboard view also
 * doesn't use this — it just follows Obsidian's own theme variables. Only
 * the sidebar/grid view is manually switchable.
 */
export type SidebarTheme = "light" | "dark";

/**
 * A Timeline category (AGENTS.md 1.4.1) — its `displayName` is what actually
 * gets written into note bodies (`- HH:mm - HH:mm [displayName] ...`), so
 * renaming a category does NOT retroactively relabel already-written lines.
 * `name` is a stable key used only for settings-side bookkeeping (matching
 * "is this a default category" for the reset/delete-guard logic below).
 */
export interface CustomCategory {
	name: string;
	displayName: string;
	color: string;
	isDefault?: boolean;
}

/** Ported from DayTime Tracker's DEFAULT_CATEGORIES — colors match design.md §2.1's existing pastel palette exactly. */
export const DEFAULT_CATEGORIES: CustomCategory[] = [
	{ name: "Work", displayName: "Work", color: "#d0e1fd", isDefault: true },
	{ name: "Study", displayName: "Study", color: "#ebd3f8", isDefault: true },
	{ name: "Rest", displayName: "Rest", color: "#d1f2e5", isDefault: true },
	{ name: "Reading", displayName: "Reading", color: "#fdecd0", isDefault: true },
	{ name: "Exercise", displayName: "Exercise", color: "#e2e5e9", isDefault: true },
];

export interface DailyWorkLogSettings {
	/**
	 * Only controls which label is inserted into newly scaffolded notes
	 * (see dailyNote.ts buildSkeletonContent). Parsing always recognizes
	 * every supported language's marker labels regardless of this setting.
	 * On first run (no saved value yet), main.ts auto-detects this from
	 * Obsidian's own UI language before falling back to the "en" default below.
	 */
	language: MarkerLanguage;
	/** Sidebar/grid view color scheme. Renamed from `theme` (see migrateLoadedSettings). */
	themeMode: SidebarTheme;
	/** Grid timeline's displayed hour range, inclusive start / exclusive end (0-24). */
	startHour: number;
	endHour: number;
	/** Vault-relative folder for daily notes. Empty string = vault root. */
	dailyNoteFolder: string;
	/** Up to 10 entries; see CustomCategory for how these map into note bodies. */
	categories: CustomCategory[];
}

export const DEFAULT_SETTINGS: DailyWorkLogSettings = {
	language: "en",
	themeMode: "light",
	startHour: 0,
	endHour: 24,
	dailyNoteFolder: "",
	categories: [...DEFAULT_CATEGORIES],
};

/**
 * Shape of settings data as it may have been saved by a pre-2026-08 version
 * of the plugin (before `theme` was renamed to `themeMode`). `loadData()`
 * returns `any`, so this is intentionally loose — it only describes the one
 * field we need to migrate off of.
 */
interface LegacySavedSettings {
	theme?: SidebarTheme;
}

/**
 * Bridges settings saved by older plugin versions onto the current shape,
 * so upgrading never silently discards a user's previous choices. Only
 * handles the `theme` -> `themeMode` rename (Object.assign in main.ts's
 * loadSettings() can't itself rename a key). Every other field — including
 * `categories` — is deliberately left alone here: a missing key already
 * falls back to DEFAULT_SETTINGS via that same Object.assign, and an EMPTY
 * `categories: []` is a real, intentional user state (they deleted every
 * category) that must NOT be silently overwritten back to the defaults.
 */
export function migrateLoadedSettings(
	loaded: (Partial<DailyWorkLogSettings> & LegacySavedSettings) | null
): Partial<DailyWorkLogSettings> {
	if (!loaded) return {};

	const { theme, ...migrated } = loaded;
	if (migrated.themeMode === undefined && theme !== undefined) {
		migrated.themeMode = theme;
	}

	return migrated;
}
