import { t } from "../i18n";
import type { MarkerLanguage, TodoItem } from "../parser";

export interface TodoListCallbacks {
	onToggle: (item: TodoItem, checked: boolean) => void;
	onAdd: (text: string) => void;
	onDelete: (item: TodoItem) => void;
}

/**
 * To-Do section: section header with a live count, an always-visible inline
 * "add" input at the top, and the checkbox list itself with a hover-reveal
 * delete button per item (design.md §4.1).
 */
export function renderTodoList(
	container: HTMLElement,
	items: TodoItem[],
	language: MarkerLanguage,
	callbacks: TodoListCallbacks
): void {
	container.empty();
	container.addClass("dwl-section", "dwl-todo-section");

	const header = container.createDiv({ cls: "dwl-section-header" });
	const title = header.createSpan({ cls: "dwl-section-title", text: `${t("sectionTodo", language)} ` });
	const incomplete = items.filter((item) => !item.checked).length;
	title.createSpan({ cls: "dwl-section-count", text: `${incomplete}/${items.length}` });

	const inputWrap = container.createDiv({ cls: "dwl-todo-input-wrap" });
	const input = inputWrap.createEl("input", { cls: "dwl-todo-input" });
	input.type = "text";
	input.placeholder = t("todoPlaceholder", language);
	input.addEventListener("keydown", (evt) => {
		if (evt.key === "Enter") {
			const value = input.value.trim();
			if (!value) return;
			callbacks.onAdd(value);
			input.value = "";
		} else if (evt.key === "Escape") {
			input.value = "";
			input.blur();
		}
	});

	const list = container.createEl("ul", { cls: "dwl-todo-list" });

	if (items.length === 0) {
		list.createDiv({ cls: "dwl-empty-state", text: t("emptyTodo", language) });
		return;
	}

	for (const item of items) {
		const row = list.createEl("li", { cls: "dwl-todo-item" });

		const checkbox = row.createEl("input", { cls: "dwl-todo-checkbox" });
		checkbox.type = "checkbox";
		checkbox.checked = item.checked;
		checkbox.addEventListener("change", () => callbacks.onToggle(item, checkbox.checked));

		row.createSpan({
			cls: item.checked ? "dwl-todo-text dwl-todo-text-checked" : "dwl-todo-text",
			text: item.text,
		});

		const deleteBtn = row.createEl("button", { cls: "dwl-todo-delete-btn", text: "✕" });
		deleteBtn.addEventListener("click", () => callbacks.onDelete(item));
	}
}
