import { App, Modal } from "obsidian";

/**
 * Generic confirm/cancel dialog reused by both To-Do deletion and Event
 * deletion (design.md §4.3). Callers own the copy (title/message/button
 * labels) so this stays purely presentational and i18n-agnostic.
 */
export class ConfirmDeleteModal extends Modal {
	constructor(
		app: App,
		private readonly titleText: string,
		private readonly message: string,
		private readonly cancelText: string,
		private readonly okText: string,
		private readonly onConfirm: () => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("dwl-confirm-modal");

		contentEl.createEl("h3", { cls: "dwl-modal-title", text: this.titleText });
		contentEl.createEl("p", { cls: "dwl-modal-text", text: this.message });

		const buttonRow = contentEl.createDiv({ cls: "dwl-modal-buttons" });

		const cancelBtn = buttonRow.createEl("button", { cls: "dwl-modal-btn-cancel", text: this.cancelText });
		cancelBtn.addEventListener("click", () => this.close());

		const okBtn = buttonRow.createEl("button", { cls: "dwl-modal-btn-save", text: this.okText });
		okBtn.addEventListener("click", () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
