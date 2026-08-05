import { Notice, TFile } from "obsidian";
import * as React from "react";
import { useEffect, useState } from "react";
import { buildSkeletonContent, formatDateBasename, formatDateFilename, isSameDate, parseDateFromBasename } from "../dailyNote";
import { t, WEEKDAYS } from "../i18n";
import { ConfirmDeleteModal } from "../modals/ConfirmDeleteModal";
import { TimelineModal, type EventEntryValues } from "../modals/TimelineModal";
import type DailyWorkLogPlugin from "../main";
import {
	appendLineToBlock,
	minutesToTime,
	parseDailyNote,
	removeLineAt,
	replaceLineAt,
	timeToMinutes,
	timelineLineMatches,
	todoLineMatches,
	type MarkerLanguage,
	type TimelineItem,
	type TodoItem,
} from "../parser";
import { buildExportHtml } from "../pdfExport";
import { getTextColorForBackground } from "./colorUtils";

/** Obsidian's "open in default app" API isn't in the public .d.ts — same optional-cast pattern DayTime Tracker uses. */
interface AppWithOpenDefault {
	openWithDefaultApp?: (path: string) => void;
}

export interface TimelineViewProps {
	plugin: DailyWorkLogPlugin;
	/**
	 * Bumped by DailyWorkLogView.refresh() whenever main.ts's existing
	 * vault-modify / active-leaf-change / settings-change plumbing
	 * (AGENTS.md §3) decides this view needs to re-sync — this component
	 * does not subscribe to Obsidian events itself, it just reacts to this.
	 */
	refreshToken: number;
}

const CELL_MINUTES = 10;
const CELLS_PER_HOUR = 60 / CELL_MINUTES;

function buildTimelineLine(values: EventEntryValues): string {
	const categoryPart = values.category ? `[${values.category}] ` : "";
	return `- ${values.start} - ${values.end} ${categoryPart}${values.description}`.trimEnd();
}

function formatDateHeader(date: Date, language: MarkerLanguage): string {
	const basename = formatDateBasename(date);
	if (isSameDate(date, new Date())) {
		return `${basename} ${language === "ko" ? "(오늘)" : "(Today)"}`;
	}
	return `${basename} (${WEEKDAYS[language][date.getDay()]})`;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ plugin, refreshToken }) => {
	const [activeFile, setActiveFile] = useState<TFile | null>(null);
	const [timeline, setTimeline] = useState<TimelineItem[]>([]);
	const [todos, setTodos] = useState<TodoItem[]>([]);
	const [isTodosExpanded, setIsTodosExpanded] = useState(true);

	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState<number | null>(null);
	const [dragEnd, setDragEnd] = useState<number | null>(null);

	const language = plugin.settings.language;
	const categories = plugin.settings.categories;
	const { startHour, endHour } = plugin.settings;

	const reloadFile = async (file: TFile): Promise<void> => {
		const content = await plugin.app.vault.read(file);
		const parsed = parseDailyNote(content);
		setTimeline(parsed.timeline);
		setTodos(parsed.todos);
	};

	// Re-syncs from the active file whenever refreshToken changes (see the
	// prop doc above). Only a real active file updates the tracked
	// `activeFile` — no active file at all (e.g. the sidebar itself has
	// focus) intentionally leaves it as-is (AGENTS.md §3).
	useEffect(() => {
		let cancelled = false;
		setIsDragging(false);
		setDragStart(null);
		setDragEnd(null);

		const run = async (): Promise<void> => {
			const file = plugin.app.workspace.getActiveFile();
			if (!file) return;
			const resolved = parseDateFromBasename(file.basename) ? file : null;
			if (cancelled) return;
			setActiveFile(resolved);
			if (!resolved) {
				setTimeline([]);
				setTodos([]);
				return;
			}
			const content = await plugin.app.vault.read(resolved);
			if (cancelled) return;
			const parsed = parseDailyNote(content);
			setTimeline(parsed.timeline);
			setTodos(parsed.todos);
		};
		void run();

		return () => {
			cancelled = true;
		};
	}, [refreshToken, plugin]);

	// Catches drag-release outside the grid (design parity with the mouse-leave handler on the grid itself).
	useEffect(() => {
		const onWindowMouseUp = (): void => {
			if (isDragging) handleMouseUp();
		};
		window.addEventListener("mouseup", onWindowMouseUp);
		return () => window.removeEventListener("mouseup", onWindowMouseUp);
	}, [isDragging, dragStart, dragEnd]);

	// ── To-Do ──────────────────────────────────────────────────────────

	const toggleTodo = async (item: TodoItem, checked: boolean): Promise<void> => {
		if (!activeFile) return;
		const content = await plugin.app.vault.read(activeFile);
		const lines = content.split("\n");
		const targetLine = lines[item.line];
		if (targetLine === undefined || !todoLineMatches(targetLine, item)) {
			await reloadFile(activeFile);
			return;
		}
		const newLine = targetLine.replace(/\[[ xX]\]/, checked ? "[x]" : "[ ]");
		await plugin.writeFile(activeFile, replaceLineAt(content, item.line, newLine));
		await reloadFile(activeFile);
	};

	const addTodo = async (text: string): Promise<void> => {
		if (!activeFile) return;
		const content = await plugin.app.vault.read(activeFile);
		await plugin.writeFile(activeFile, appendLineToBlock(content, "todo", `- [ ] ${text}`));
		await reloadFile(activeFile);
	};

	const deleteTodo = async (item: TodoItem): Promise<void> => {
		if (!activeFile) return;
		const content = await plugin.app.vault.read(activeFile);
		const lines = content.split("\n");
		const targetLine = lines[item.line];
		if (targetLine === undefined || !todoLineMatches(targetLine, item)) {
			await reloadFile(activeFile);
			return;
		}
		await plugin.writeFile(activeFile, removeLineAt(content, item.line));
		await reloadFile(activeFile);
	};

	const confirmDeleteTodo = (item: TodoItem): void => {
		new ConfirmDeleteModal(
			plugin.app,
			t("confirmTitle", language),
			t("confirmDeleteTask", language).replace("%s", item.text),
			t("btnCancel", language),
			t("confirmOk", language),
			() => void deleteTodo(item)
		).open();
	};

	// ── Event (Timeline) ──────────────────────────────────────────────

	const addEvent = async (values: EventEntryValues): Promise<void> => {
		if (!activeFile) return;
		const content = await plugin.app.vault.read(activeFile);
		await plugin.writeFile(activeFile, appendLineToBlock(content, "timeline", buildTimelineLine(values)));
		await reloadFile(activeFile);
	};

	const updateEvent = async (item: TimelineItem, values: EventEntryValues): Promise<void> => {
		if (!activeFile) return;
		const content = await plugin.app.vault.read(activeFile);
		const lines = content.split("\n");
		const targetLine = lines[item.line];
		if (targetLine === undefined || !timelineLineMatches(targetLine, item)) {
			await reloadFile(activeFile);
			return;
		}
		await plugin.writeFile(activeFile, replaceLineAt(content, item.line, buildTimelineLine(values)));
		await reloadFile(activeFile);
	};

	const deleteEvent = async (item: TimelineItem): Promise<void> => {
		if (!activeFile) return;
		const content = await plugin.app.vault.read(activeFile);
		const lines = content.split("\n");
		const targetLine = lines[item.line];
		if (targetLine === undefined || !timelineLineMatches(targetLine, item)) {
			await reloadFile(activeFile);
			return;
		}
		await plugin.writeFile(activeFile, removeLineAt(content, item.line));
		await reloadFile(activeFile);
	};

	const openEventModal = (item: TimelineItem | null, defaultStart: string, defaultEnd: string): void => {
		new TimelineModal(
			plugin.app,
			language,
			categories,
			item,
			defaultStart,
			defaultEnd,
			(values) => {
				if (item) {
					void updateEvent(item, values);
				} else {
					void addEvent(values);
				}
			},
			item
				? () => {
						new ConfirmDeleteModal(
							plugin.app,
							t("confirmTitle", language),
							t("confirmDeleteEvent", language),
							t("btnCancel", language),
							t("confirmOk", language),
							() => void deleteEvent(item)
						).open();
					}
				: null
		).open();
	};

	// ── Today's note ───────────────────────────────────────────────────

	const openTodayNote = async (): Promise<void> => {
		const today = new Date();
		const filename = formatDateFilename(today);
		const folder = plugin.settings.dailyNoteFolder.trim().replace(/^\/+|\/+$/g, "");
		const filePath = folder ? `${folder}/${filename}` : filename;

		let file = plugin.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			if (folder && !plugin.app.vault.getAbstractFileByPath(folder)) {
				await plugin.app.vault.createFolder(folder);
			}
			file = await plugin.app.vault.create(filePath, buildSkeletonContent(language));
		}
		if (file instanceof TFile) {
			const leaf = plugin.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		}
	};

	// ── PDF / HTML export (design.md §13) ───────────────────────────────

	const exportToPdf = async (): Promise<void> => {
		if (!activeFile) return;
		const dateForFile = parseDateFromBasename(activeFile.basename);
		const dateHeader = dateForFile ? formatDateHeader(dateForFile, language) : activeFile.basename;

		const html = buildExportHtml({
			dateHeader,
			timeline,
			todos,
			categories,
			themeMode: plugin.settings.themeMode,
			startHour,
			endHour,
			uncategorizedLabel: t("uncategorized", language),
			todayTodosLabel: t("todayTodosTitle", language),
			printButtonLabel: t("printButton", language),
		});

		const exportFileName = `Timeline-Export-${activeFile.basename}.html`;
		let file = plugin.app.vault.getAbstractFileByPath(exportFileName);
		if (file instanceof TFile) {
			await plugin.app.vault.modify(file, html);
		} else {
			file = await plugin.app.vault.create(exportFileName, html);
		}

		if (file instanceof TFile) {
			const appWithOpenDefault = plugin.app as unknown as AppWithOpenDefault;
			appWithOpenDefault.openWithDefaultApp?.(file.path);
			new Notice(t("exportSuccess", language));
		}
	};

	// ── Drag-to-select ────────────────────────────────────────────────

	const handleMouseDown = (cellIndex: number): void => {
		setIsDragging(true);
		setDragStart(cellIndex);
		setDragEnd(cellIndex);
	};

	const handleMouseEnter = (cellIndex: number): void => {
		if (isDragging) setDragEnd(cellIndex);
	};

	const handleMouseUp = (): void => {
		if (!isDragging || dragStart === null || dragEnd === null) return;
		setIsDragging(false);

		const startIdx = Math.min(dragStart, dragEnd);
		const endIdx = Math.max(dragStart, dragEnd);
		openEventModal(null, minutesToTime(startIdx * CELL_MINUTES), minutesToTime((endIdx + 1) * CELL_MINUTES));

		setDragStart(null);
		setDragEnd(null);
	};

	// ── Render ────────────────────────────────────────────────────────

	if (!activeFile) {
		const currentFile = plugin.app.workspace.getActiveFile();
		const isNotDailyNote = !!currentFile;
		return (
			<div className="dwl-view">
				<div className="dwl-empty-state-block">
					<h3>{t(isNotDailyNote ? "emptyStateTitleNotDaily" : "emptyStateTitleNoNote", language)}</h3>
					{/* The "not a daily note" case skips the description entirely — the title alone is enough. */}
					{!isNotDailyNote && <p>{t("emptyStateDescNoNote", language)}</p>}
					<button
						type="button"
						className="dwl-modal-btn-save dwl-empty-state-btn"
						onClick={() => {
							void openTodayNote();
						}}
					>
						{t("createTodayNoteButton", language)}
					</button>
				</div>
			</div>
		);
	}

	const dateForFile = parseDateFromBasename(activeFile.basename);
	if (!dateForFile) return null;

	const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

	return (
		<div className="dwl-view">
			<div className="dwl-view-header">
				<h2 className="dwl-view-date-title">{formatDateHeader(dateForFile, language)}</h2>
				<div className="dwl-header-btn-group">
					<button
						type="button"
						className="dwl-header-btn"
						title={t("exportPdfDesc", language)}
						onClick={() => {
							void exportToPdf();
						}}
					>
						{t("exportPdfButton", language)}
					</button>
					<button
						type="button"
						className="dwl-header-btn"
						onClick={() => {
							void openTodayNote();
						}}
					>
						{t("todayNoteButton", language)}
					</button>
				</div>
			</div>

			<div
				className="dwl-grid-wrap"
				onMouseLeave={() => {
					if (isDragging) handleMouseUp();
				}}
			>
				<div className="dwl-grid">
					{hours.map((hour) => {
						const hourStartMin = hour * 60;
						const hourEndMin = (hour + 1) * 60;
						const overlapping = timeline
							.map((item, index) => ({ item, index }))
							.filter(({ item }) => {
								const s = timeToMinutes(item.start);
								const e = timeToMinutes(item.end);
								return Math.max(s, hourStartMin) < Math.min(e, hourEndMin);
							});

						const isPm = hour >= 12;
						const displayHour = hour === 0 || hour === 24 ? 12 : hour > 12 ? hour - 12 : hour;
						const ampm = hour === 24 || !isPm ? "AM" : "PM";

						return (
							<div key={hour} className="dwl-grid-row">
								<div className="dwl-grid-hour-label">
									<span className="dwl-grid-hour-num">{displayHour}</span>
									<span className="dwl-grid-hour-ampm">{ampm}</span>
								</div>
								<div className="dwl-grid-cells">
									{Array.from({ length: CELLS_PER_HOUR }).map((_, colIndex) => {
										const cellIndex = hour * CELLS_PER_HOUR + colIndex;
										let isSelecting = false;
										if (isDragging && dragStart !== null && dragEnd !== null) {
											const min = Math.min(dragStart, dragEnd);
											const max = Math.max(dragStart, dragEnd);
											isSelecting = cellIndex >= min && cellIndex <= max;
										}
										return (
											<div
												key={colIndex}
												className={`dwl-grid-cell${isSelecting ? " is-selecting" : ""}`}
												onMouseDown={() => handleMouseDown(cellIndex)}
												onMouseEnter={() => handleMouseEnter(cellIndex)}
												onMouseUp={handleMouseUp}
											/>
										);
									})}

									{overlapping.map(({ item, index }) => {
										const s = timeToMinutes(item.start);
										const e = timeToMinutes(item.end);
										const overlapStart = Math.max(s, hourStartMin);
										const overlapEnd = Math.min(e, hourEndMin);
										const startCol = (overlapStart - hourStartMin) / CELL_MINUTES;
										const endCol = (overlapEnd - hourStartMin) / CELL_MINUTES;
										const leftPercent = (startCol / CELLS_PER_HOUR) * 100;
										const widthPercent = ((endCol - startCol) / CELLS_PER_HOUR) * 100;

										const catObj = categories.find((c) => c.displayName === item.category);
										const bgColor = catObj?.color ?? "var(--dwl-bg-active)";
										const textColor = catObj ? getTextColorForBackground(catObj.color) : "var(--dwl-text)";
										const label = item.category ?? t("uncategorized", language);
										const isShort = overlapEnd - overlapStart <= CELL_MINUTES;

										return (
											<div
												key={index}
												className="dwl-grid-block"
												style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, backgroundColor: bgColor, color: textColor }}
												title={`${item.start} ~ ${item.end} | ${label}${item.description ? `\n${item.description}` : ""}`}
												onClick={(evt) => {
													evt.stopPropagation();
													openEventModal(item, item.start, item.end);
												}}
												onMouseDown={(evt) => evt.stopPropagation()}
											>
												<strong>{label}</strong>
												{!isShort && ` (${item.start}-${item.end})`}
											</div>
										);
									})}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			<div className="dwl-section dwl-todo-section">
				<div
					className="dwl-section-header dwl-todo-header"
					onClick={() => setIsTodosExpanded(!isTodosExpanded)}
				>
					<span className="dwl-section-title">
						{t("todayTodosTitle", language)}{" "}
						<span className="dwl-section-count">
							{todos.filter((it) => it.checked).length}/{todos.length}
						</span>
					</span>
					<span className={`dwl-todo-toggle-icon${isTodosExpanded ? "" : " is-collapsed"}`}>▼</span>
				</div>

				{isTodosExpanded && (
					<div className="dwl-todo-body">
						<div className="dwl-todo-input-wrap">
							<input
								className="dwl-todo-input"
								type="text"
								placeholder={t("todoPlaceholder", language)}
								onKeyDown={(evt) => {
									evt.stopPropagation();
									if (evt.key === "Enter") {
										const value = evt.currentTarget.value.trim();
										if (value) {
											void addTodo(value);
											evt.currentTarget.value = "";
										}
									} else if (evt.key === "Escape") {
										evt.currentTarget.value = "";
										evt.currentTarget.blur();
									}
								}}
							/>
						</div>

						{todos.length === 0 ? (
							<div className="dwl-empty-state">{t("emptyTodo", language)}</div>
						) : (
							<ul className="dwl-todo-list">
								{todos.map((item) => (
									<li key={item.line} className="dwl-todo-item">
										<input
											className="dwl-todo-checkbox"
											type="checkbox"
											checked={item.checked}
											onChange={(evt) => void toggleTodo(item, evt.target.checked)}
										/>
										<span className={`dwl-todo-text${item.checked ? " dwl-todo-text-checked" : ""}`}>{item.text}</span>
										<button type="button" className="dwl-todo-delete-btn" onClick={() => confirmDeleteTodo(item)}>
											✕
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				)}
			</div>
		</div>
	);
};
