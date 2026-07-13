import { App, Modal, Notice } from "obsidian";
import { t } from "../i18n";
import { TIME_VALUE_REGEX, type MarkerLanguage } from "../parser";

export interface EventEntryValues {
	start: string;
	end: string;
	description: string;
}

/**
 * Add/edit modal for Event (Timeline) items (design.md §4.2). Delete is
 * intentionally NOT performed here — clicking Delete only asks the caller
 * to handle it (`onRequestDelete`), so the confirm-dialog step lives in one
 * place (view.ts) shared with To-Do deletion, not duplicated per modal.
 */
export class EventEntryModal extends Modal {
	private startInput!: HTMLInputElement;
	private endInput!: HTMLInputElement;
	private descInput!: HTMLTextAreaElement;

	constructor(
		app: App,
		private readonly language: MarkerLanguage,
		private readonly initial: EventEntryValues | null,
		private readonly onSave: (values: EventEntryValues) => void,
		private readonly onRequestDelete: (() => void) | null
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("dwl-event-modal");

		contentEl.createEl("h3", {
			cls: "dwl-modal-title",
			text: this.initial ? t("modalEditTitle", this.language) : t("modalAddTitle", this.language),
		});

		const timeField = contentEl.createDiv({ cls: "dwl-modal-field" });
		timeField.createEl("label", { cls: "dwl-modal-label", text: t("lblTimeSet", this.language) });
		const timeRow = timeField.createDiv({ cls: "dwl-modal-time-row" });

		this.startInput = timeRow.createEl("input", { cls: "dwl-modal-time-input" });
		this.startInput.type = "text";
		this.startInput.placeholder = "09:00";
		this.startInput.value = this.initial?.start ?? "";

		this.endInput = timeRow.createEl("input", { cls: "dwl-modal-time-input" });
		this.endInput.type = "text";
		this.endInput.placeholder = "10:00";
		this.endInput.value = this.initial?.end ?? "";

		const descField = contentEl.createDiv({ cls: "dwl-modal-field" });
		descField.createEl("label", { cls: "dwl-modal-label", text: t("lblContent", this.language) });
		this.descInput = descField.createEl("textarea", { cls: "dwl-modal-textarea" });
		this.descInput.rows = 3;
		this.descInput.placeholder = t("descPlaceholder", this.language);
		this.descInput.value = this.initial?.description ?? "";

		const buttonRow = contentEl.createDiv({ cls: "dwl-modal-buttons" });

		if (this.onRequestDelete) {
			const deleteBtn = buttonRow.createEl("button", {
				cls: "dwl-modal-btn-delete",
				text: t("btnDelete", this.language),
			});
			deleteBtn.addEventListener("click", () => {
				this.close();
				this.onRequestDelete?.();
			});
		}

		const cancelBtn = buttonRow.createEl("button", { cls: "dwl-modal-btn-cancel", text: t("btnCancel", this.language) });
		cancelBtn.addEventListener("click", () => this.close());

		const saveBtn = buttonRow.createEl("button", { cls: "dwl-modal-btn-save", text: t("btnSave", this.language) });
		saveBtn.addEventListener("click", () => this.handleSave());
	}

	private handleSave(): void {
		const start = this.startInput.value.trim();
		const end = this.endInput.value.trim();
		const description = this.descInput.value.trim();

		if (!TIME_VALUE_REGEX.test(start) || !TIME_VALUE_REGEX.test(end)) {
			new Notice(t("invalidTimeFormat", this.language));
			return;
		}

		this.onSave({ start, end, description });
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
