import { t } from "../i18n";
import { timeToMinutes, timelineDurationMinutes, type MarkerLanguage, type TimelineItem } from "../parser";

export interface TimelineCallbacks {
	onAdd: () => void;
	onEditItem: (item: TimelineItem) => void;
}

/**
 * Event (Timeline) section: header with a "+ Add" button, and a list of
 * clickable item cards (click -> edit modal). Design.md §5 renames this
 * section "Event" in the UI; the source file keeps its original name
 * (`Timeline.ts`) to match the file layout already recorded in task.md.
 */
export function renderTimeline(
	container: HTMLElement,
	items: TimelineItem[],
	language: MarkerLanguage,
	callbacks: TimelineCallbacks
): void {
	container.empty();
	container.addClass("dwl-section", "dwl-timeline-section");

	const header = container.createDiv({ cls: "dwl-section-header" });
	header.createSpan({ cls: "dwl-section-title", text: t("sectionEvent", language) });
	const addBtn = header.createEl("button", { cls: "dwl-section-add-btn", text: t("btnAdd", language) });
	addBtn.addEventListener("click", () => callbacks.onAdd());

	const list = container.createDiv({ cls: "dwl-timeline" });

	if (items.length === 0) {
		list.createDiv({ cls: "dwl-empty-state", text: t("emptyEvent", language) });
		return;
	}

	const sorted = [...items].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

	for (const item of sorted) {
		const block = list.createDiv({ cls: "dwl-timeline-item" });
		block.style.setProperty("--dwl-duration-minutes", String(timelineDurationMinutes(item)));
		block.createDiv({ cls: "dwl-timeline-time", text: `${item.start} - ${item.end}` });
		block.createDiv({ cls: "dwl-timeline-desc", text: item.description || t("noDescription", language) });
		block.addEventListener("click", () => callbacks.onEditItem(item));
	}
}
