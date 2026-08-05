/**
 * Picks a readable text color (near-black or white) for a given category
 * background hex color, by relative luminance. Ported from DayTime Tracker's
 * TimelineView — same formula, so category chips/blocks read consistently
 * with the reference implementation this UI was ported from.
 */
export function getTextColorForBackground(hexColor: string): string {
	if (!hexColor) return "#ffffff";
	const color = hexColor.startsWith("#") ? hexColor.slice(1) : hexColor;
	if (color.length !== 6) return "#ffffff";

	const r = parseInt(color.substring(0, 2), 16);
	const g = parseInt(color.substring(2, 4), 16);
	const b = parseInt(color.substring(4, 6), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

	return luminance > 0.6 ? "#1e293b" : "#ffffff";
}
