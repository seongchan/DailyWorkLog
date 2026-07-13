import { describe, expect, it } from "vitest";
import { STRINGS, WEEKDAYS, t } from "./i18n";

describe("t", () => {
	it("returns the string for the given language", () => {
		expect(t("btnSave", "en")).toBe("Save");
		expect(t("btnSave", "ko")).toBe("저장");
	});
});

describe("STRINGS", () => {
	it("has the exact same set of keys for every language", () => {
		const enKeys = Object.keys(STRINGS.en).sort();
		const koKeys = Object.keys(STRINGS.ko).sort();
		expect(koKeys).toEqual(enKeys);
	});
});

describe("WEEKDAYS", () => {
	it("has 7 entries per language", () => {
		expect(WEEKDAYS.en).toHaveLength(7);
		expect(WEEKDAYS.ko).toHaveLength(7);
	});
});
