import { App, Modal } from "obsidian";
import { t } from "../i18n";
import type { MarkerLanguage } from "../parser";

/**
 * Shown when the user clicks an arbitrary (past/future) date in the Calendar
 * grid that has no file yet. The dedicated "오늘" button intentionally skips
 * this modal (AGENTS.md 2. New Daily Note Creation & Confirmation Policy).
 */
export class ConfirmCreateNoteModal extends Modal {
	constructor(
		app: App,
		private readonly filename: string,
		private readonly language: MarkerLanguage,
		private readonly onConfirm: () => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("dwl-confirm-modal");
		contentEl.createEl("p", {
			cls: "dwl-modal-text",
			text: t("noteNotFoundConfirm", this.language).replace("%s", this.filename),
		});

		const buttonRow = contentEl.createDiv({ cls: "dwl-modal-buttons" });

		const cancelBtn = buttonRow.createEl("button", { cls: "dwl-modal-btn-cancel", text: t("btnCancel", this.language) });
		cancelBtn.addEventListener("click", () => this.close());

		const confirmBtn = buttonRow.createEl("button", {
			cls: "dwl-modal-btn-save",
			text: t("btnCreate", this.language),
		});
		confirmBtn.addEventListener("click", () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
