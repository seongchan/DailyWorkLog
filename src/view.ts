import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import type DailyWorkLogPlugin from "./main";
import {
	appendLineToBlock,
	parseDailyNote,
	removeLineAt,
	replaceLineAt,
	timelineLineMatches,
	todoLineMatches,
	type TimelineItem,
	type TodoItem,
} from "./parser";
import { buildSkeletonContent, formatDateFilename, parseDateFromBasename } from "./dailyNote";
import { Calendar } from "./components/Calendar";
import { renderTimeline } from "./components/Timeline";
import { renderTodoList } from "./components/TodoList";
import { ConfirmCreateNoteModal } from "./modals/ConfirmCreateNoteModal";
import { ConfirmDeleteModal } from "./modals/ConfirmDeleteModal";
import { EventEntryModal, type EventEntryValues } from "./modals/EventEntryModal";
import { t } from "./i18n";

export const VIEW_TYPE_DAILY_WORK_LOG = "daily-work-log-view";

export class DailyWorkLogView extends ItemView {
	private readonly plugin: DailyWorkLogPlugin;
	private currentFile: TFile | null = null;
	// Kept across refresh() calls (see refresh() below) so prev/next month
	// navigation survives unrelated re-renders instead of resetting every time.
	private calendar: Calendar | null = null;
	private calendarEl: HTMLElement | null = null;
	private sectionsEl: HTMLElement | null = null;
	/**
	 * `refresh()` isn't re-entrant safe on its own: it does a synchronous
	 * `container.empty()` before an `await vault.read()`, so overlapping
	 * calls (active-leaf-change + modify + onOpen firing close together)
	 * can interleave — a later call's empty() wipes an earlier call's
	 * calendar, then both calls' async continuations append their own
	 * Event/To-Do sections afterward, producing duplicated sections. This
	 * token lets a stale (superseded) call detect it's no longer the latest
	 * one and bail out after its `await` instead of rendering anything.
	 */
	private refreshToken = 0;

	constructor(leaf: WorkspaceLeaf, plugin: DailyWorkLogPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_DAILY_WORK_LOG;
	}

	getDisplayText(): string {
		return "Daily work log";
	}

	getIcon(): string {
		return "calendar-clock";
	}

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	onClose(): Promise<void> {
		return Promise.resolve();
	}

	async refresh(): Promise<void> {
		const token = ++this.refreshToken;
		const container = this.containerEl.children[1] as HTMLElement;
		container.addClass("dwl-view");
		container.removeClass("dwl-theme-light", "dwl-theme-dark");
		container.addClass(`dwl-theme-${this.plugin.settings.theme}`);

		// calendarEl/sectionsEl are created ONCE and reused — see the `calendar`
		// field comment. Only the very first refresh() call hits this branch.
		if (!this.calendarEl || !this.sectionsEl) {
			container.empty();
			this.calendarEl = container.createDiv();
			this.sectionsEl = container.createDiv();
		}

		const language = this.plugin.settings.language;

		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			// Only a real, non-daily-note active file clears the stale selection —
			// no active file at all (e.g. this sidebar itself has focus) is left
			// alone so the calendar/timeline don't blank out on every leaf switch.
			this.currentFile = parseDateFromBasename(activeFile.basename) ? activeFile : null;
		}

		const selectedDate = this.currentFile ? parseDateFromBasename(this.currentFile.basename) : null;

		if (!this.calendar) {
			this.calendar = new Calendar(
				this.calendarEl,
				this.app,
				language,
				{
					onSelectDate: (date, opts) => {
						void this.openDateFile(date, opts.skipConfirmation);
					},
				},
				selectedDate
			);
		} else {
			this.calendar.update(language, selectedDate);
		}

		const contentEl = this.sectionsEl;
		contentEl.empty();

		if (!this.currentFile) {
			contentEl.createDiv({
				cls: "dwl-empty-state",
				text: t("noActiveNote", language),
			});
			return;
		}

		const content = await this.app.vault.read(this.currentFile);
		if (token !== this.refreshToken) return; // superseded by a newer refresh() call meanwhile

		const parsed = parseDailyNote(content);

		const timelineEl = contentEl.createDiv();
		renderTimeline(timelineEl, parsed.timeline, language, {
			onAdd: () => this.openEventModal(null),
			onEditItem: (item) => this.openEventModal(item),
		});

		const todoEl = contentEl.createDiv();
		renderTodoList(todoEl, parsed.todos, language, {
			onToggle: (item, checked) => void this.toggleTodo(item, checked),
			onAdd: (text) => void this.addTodo(text),
			onDelete: (item) => this.confirmDeleteTodo(item),
		});
	}

	// ── To-Do ──────────────────────────────────────────────────────────

	private async toggleTodo(item: TodoItem, checked: boolean): Promise<void> {
		if (!this.currentFile) return;

		const content = await this.app.vault.read(this.currentFile);
		const lines = content.split("\n");
		const targetLine = lines[item.line];

		// The file may have changed between render and click (lines inserted/
		// removed elsewhere while the sidebar was showing a stale render).
		// item.line is only trustworthy if that exact line still looks like
		// the same To-Do item — otherwise abort instead of mutating whatever
		// now happens to sit on that line (AGENTS.md 1.5 / design.md §7).
		if (targetLine === undefined || !todoLineMatches(targetLine, item)) {
			await this.refresh();
			return;
		}

		const newLine = targetLine.replace(/\[[ xX]\]/, checked ? "[x]" : "[ ]");
		await this.plugin.writeFile(this.currentFile, replaceLineAt(content, item.line, newLine));
		await this.refresh();
	}

	private async addTodo(text: string): Promise<void> {
		if (!this.currentFile) return;
		const content = await this.app.vault.read(this.currentFile);
		const newContent = appendLineToBlock(content, "todo", `- [ ] ${text}`);
		await this.plugin.writeFile(this.currentFile, newContent);
		await this.refresh();
	}

	private confirmDeleteTodo(item: TodoItem): void {
		const language = this.plugin.settings.language;
		new ConfirmDeleteModal(
			this.app,
			t("confirmTitle", language),
			t("confirmDeleteTask", language).replace("%s", item.text),
			t("btnCancel", language),
			t("confirmOk", language),
			() => void this.deleteTodo(item)
		).open();
	}

	private async deleteTodo(item: TodoItem): Promise<void> {
		if (!this.currentFile) return;
		const content = await this.app.vault.read(this.currentFile);
		const lines = content.split("\n");
		const targetLine = lines[item.line];

		if (targetLine === undefined || !todoLineMatches(targetLine, item)) {
			await this.refresh();
			return;
		}

		await this.plugin.writeFile(this.currentFile, removeLineAt(content, item.line));
		await this.refresh();
	}

	// ── Event (Timeline) ──────────────────────────────────────────────

	private openEventModal(item: TimelineItem | null): void {
		const language = this.plugin.settings.language;

		new EventEntryModal(
			this.app,
			language,
			item ? { start: item.start, end: item.end, description: item.description } : null,
			(values) => {
				if (item) {
					void this.updateEvent(item, values);
				} else {
					void this.addEvent(values);
				}
			},
			item
				? () => {
						new ConfirmDeleteModal(
							this.app,
							t("confirmTitle", language),
							t("confirmDeleteEvent", language),
							t("btnCancel", language),
							t("confirmOk", language),
							() => void this.deleteEvent(item)
						).open();
					}
				: null
		).open();
	}

	private async addEvent(values: EventEntryValues): Promise<void> {
		if (!this.currentFile) return;
		const content = await this.app.vault.read(this.currentFile);
		const newLine = `- ${values.start} - ${values.end} ${values.description}`.trimEnd();
		const newContent = appendLineToBlock(content, "timeline", newLine);
		await this.plugin.writeFile(this.currentFile, newContent);
		await this.refresh();
	}

	private async updateEvent(item: TimelineItem, values: EventEntryValues): Promise<void> {
		if (!this.currentFile) return;
		const content = await this.app.vault.read(this.currentFile);
		const lines = content.split("\n");
		const targetLine = lines[item.line];

		if (targetLine === undefined || !timelineLineMatches(targetLine, item)) {
			await this.refresh();
			return;
		}

		const newLine = `- ${values.start} - ${values.end} ${values.description}`.trimEnd();
		await this.plugin.writeFile(this.currentFile, replaceLineAt(content, item.line, newLine));
		await this.refresh();
	}

	private async deleteEvent(item: TimelineItem): Promise<void> {
		if (!this.currentFile) return;
		const content = await this.app.vault.read(this.currentFile);
		const lines = content.split("\n");
		const targetLine = lines[item.line];

		if (targetLine === undefined || !timelineLineMatches(targetLine, item)) {
			await this.refresh();
			return;
		}

		await this.plugin.writeFile(this.currentFile, removeLineAt(content, item.line));
		await this.refresh();
	}

	// ── Calendar / note creation ──────────────────────────────────────

	private async openDateFile(date: Date, skipConfirmation: boolean): Promise<void> {
		const filename = formatDateFilename(date);
		const existing = this.app.vault.getAbstractFileByPath(filename);

		if (existing instanceof TFile) {
			await this.openFile(existing);
			return;
		}

		const create = async () => {
			const file = await this.app.vault.create(filename, buildSkeletonContent(this.plugin.settings.language));
			await this.openFile(file);
		};

		if (skipConfirmation) {
			await create();
			return;
		}

		new ConfirmCreateNoteModal(this.app, filename, this.plugin.settings.language, () => void create()).open();
	}

	private async openFile(file: TFile): Promise<void> {
		this.currentFile = file;
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);
		await this.refresh();
	}
}
