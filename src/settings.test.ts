import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, migrateLoadedSettings } from "./settings";

describe("migrateLoadedSettings", () => {
	it("returns an empty object for a brand-new install (loadData() -> null)", () => {
		expect(migrateLoadedSettings(null)).toEqual({});
	});

	it("migrates the old `theme` field onto `themeMode` when themeMode is absent", () => {
		const migrated = migrateLoadedSettings({ language: "ko", theme: "dark" });
		expect(migrated.themeMode).toBe("dark");
		expect(migrated).not.toHaveProperty("theme");
	});

	it("prefers an existing themeMode over a stale theme value, instead of overwriting it", () => {
		const migrated = migrateLoadedSettings({ theme: "dark", themeMode: "light" });
		expect(migrated.themeMode).toBe("light");
	});

	it("does not touch categories when the key is simply absent (Object.assign supplies the default later)", () => {
		const migrated = migrateLoadedSettings({ language: "en" });
		expect(migrated).not.toHaveProperty("categories");
	});

	it("preserves an intentionally-emptied categories list instead of resetting it to defaults", () => {
		const migrated = migrateLoadedSettings({ categories: [] });
		expect(migrated.categories).toEqual([]);
	});

	it("full merge onto DEFAULT_SETTINGS backfills every genuinely-missing field", () => {
		const loaded = { theme: "dark" as const };
		const merged = Object.assign({}, DEFAULT_SETTINGS, migrateLoadedSettings(loaded));
		expect(merged.themeMode).toBe("dark");
		expect(merged.categories).toEqual(DEFAULT_SETTINGS.categories);
		expect(merged.startHour).toBe(0);
		expect(merged.endHour).toBe(24);
	});
});
