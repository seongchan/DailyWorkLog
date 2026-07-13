import { App } from "obsidian";
import { formatDateBasename, isSameDate } from "../dailyNote";
import { WEEKDAYS, t } from "../i18n";
import type { MarkerLanguage } from "../parser";

export interface CalendarCallbacks {
	/** skipConfirmation is true only for the dedicated "오늘" button. */
	onSelectDate: (date: Date, opts: { skipConfirmation: boolean }) => void;
}

const DAILY_NOTE_FILENAME_REGEX = /^(\d{4})-(\d{2})-(\d{2})\.md$/;

export class Calendar {
	private readonly containerEl: HTMLElement;
	private readonly app: App;
	private language: MarkerLanguage;
	private readonly callbacks: CalendarCallbacks;
	private viewedYear: number;
	private viewedMonth: number; // 0-11
	private selectedDate: Date | null;

	constructor(
		containerEl: HTMLElement,
		app: App,
		language: MarkerLanguage,
		callbacks: CalendarCallbacks,
		selectedDate: Date | null
	) {
		this.containerEl = containerEl;
		this.app = app;
		this.language = language;
		this.callbacks = callbacks;
		this.selectedDate = selectedDate;

		const base = selectedDate ?? new Date();
		this.viewedYear = base.getFullYear();
		this.viewedMonth = base.getMonth();

		this.render();
	}

	/**
	 * Re-renders this SAME instance in place (caller keeps reusing one
	 * Calendar across `DailyWorkLogView.refresh()` calls instead of
	 * constructing a new one each time). Manual month navigation
	 * (prev/next) is preserved UNLESS `selectedDate` actually changed from
	 * what it was last time — a genuinely new file being opened still jumps
	 * the view to that file's month, matching the original behavior.
	 */
	update(language: MarkerLanguage, selectedDate: Date | null): void {
		const dateChanged = !datesEqual(this.selectedDate, selectedDate);
		this.language = language;
		this.selectedDate = selectedDate;

		if (dateChanged && selectedDate) {
			this.viewedYear = selectedDate.getFullYear();
			this.viewedMonth = selectedDate.getMonth();
		}

		this.render();
	}

	private stepMonth(delta: number): void {
		this.viewedMonth += delta;
		if (this.viewedMonth < 0) {
			this.viewedMonth = 11;
			this.viewedYear -= 1;
		} else if (this.viewedMonth > 11) {
			this.viewedMonth = 0;
			this.viewedYear += 1;
		}
		this.render();
	}

	private goToToday(): void {
		const today = new Date();
		this.viewedYear = today.getFullYear();
		this.viewedMonth = today.getMonth();
		this.render();
		this.callbacks.onSelectDate(today, { skipConfirmation: true });
	}

	private render(): void {
		this.containerEl.empty();
		this.containerEl.addClass("dwl-calendar");

		const nav = this.containerEl.createDiv({ cls: "dwl-calendar-nav" });

		const prevBtn = nav.createEl("button", { cls: "dwl-calendar-nav-btn", text: "◀" });
		prevBtn.addEventListener("click", () => this.stepMonth(-1));

		const todayBtn = nav.createEl("button", { cls: "dwl-calendar-today-btn", text: t("btnToday", this.language) });
		todayBtn.addEventListener("click", () => this.goToToday());

		const nextBtn = nav.createEl("button", { cls: "dwl-calendar-nav-btn", text: "▶" });
		nextBtn.addEventListener("click", () => this.stepMonth(1));

		this.containerEl.createDiv({
			cls: "dwl-calendar-label",
			text: `${this.viewedYear}. ${this.viewedMonth + 1}`,
		});

		const weekdayRow = this.containerEl.createDiv({ cls: "dwl-calendar-weekdays" });
		for (const label of WEEKDAYS[this.language]) {
			weekdayRow.createDiv({ cls: "dwl-calendar-weekday", text: label });
		}

		const grid = this.containerEl.createDiv({ cls: "dwl-calendar-grid" });
		this.renderGrid(grid);
	}

	private renderGrid(grid: HTMLElement): void {
		const daysInMonth = new Date(this.viewedYear, this.viewedMonth + 1, 0).getDate();
		const firstWeekday = new Date(this.viewedYear, this.viewedMonth, 1).getDay();
		const notedDates = this.getDatesWithNotes();
		const today = new Date();

		for (let i = 0; i < firstWeekday; i++) {
			grid.createDiv({ cls: "dwl-calendar-cell dwl-calendar-cell-empty" });
		}

		for (let day = 1; day <= daysInMonth; day++) {
			const date = new Date(this.viewedYear, this.viewedMonth, day);
			const cell = grid.createDiv({ cls: "dwl-calendar-cell", text: String(day) });

			if (isSameDate(date, today)) cell.addClass("dwl-calendar-cell-today");
			if (this.selectedDate && isSameDate(date, this.selectedDate)) {
				cell.addClass("dwl-calendar-cell-selected");
			}
			if (notedDates.has(formatDateBasename(date))) cell.addClass("dwl-calendar-cell-has-note");

			cell.addEventListener("click", () => {
				this.callbacks.onSelectDate(date, { skipConfirmation: false });
			});
		}
	}

	private getDatesWithNotes(): Set<string> {
		const result = new Set<string>();
		for (const file of this.app.vault.getFiles()) {
			if (DAILY_NOTE_FILENAME_REGEX.test(file.name)) {
				result.add(file.name.slice(0, -".md".length));
			}
		}
		return result;
	}
}

function datesEqual(a: Date | null, b: Date | null): boolean {
	if (a === null || b === null) return a === b;
	return isSameDate(a, b);
}
