import { App, Modal, Notice } from "obsidian";
import * as React from "react";
import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { t } from "../i18n";
import { isTopLevelOrMarker, TIME_VALUE_REGEX, type MarkerLanguage, type TimelineItem } from "../parser";
import type { CustomCategory } from "../settings";

export interface EventEntryValues {
	start: string;
	end: string;
	/** Category *display name*, stored verbatim in the body (AGENTS.md 1.4.1) — undefined when left uncategorized. */
	category?: string;
	description: string;
}

interface TimelineModalContentProps {
	language: MarkerLanguage;
	categories: CustomCategory[];
	initial: TimelineItem | null;
	defaultStart: string;
	defaultEnd: string;
	onSave: (values: EventEntryValues) => void;
	onDelete: (() => void) | null;
	onCancel: () => void;
}

function TimelineModalContent({
	language,
	categories,
	initial,
	defaultStart,
	defaultEnd,
	onSave,
	onDelete,
	onCancel,
}: TimelineModalContentProps): React.JSX.Element {
	const [start, setStart] = useState(initial ? initial.start : defaultStart);
	const [end, setEnd] = useState(initial ? initial.end : defaultEnd);
	const [category, setCategory] = useState<string | undefined>(initial ? initial.category : undefined);
	const [description, setDescription] = useState(initial ? initial.description : "");

	const handleSave = (): void => {
		if (!TIME_VALUE_REGEX.test(start) || !TIME_VALUE_REGEX.test(end)) {
			new Notice(t("invalidTimeFormat", language));
			return;
		}
		// Cap consecutive blank lines at one (3+ newlines in a row collapse to
		// exactly 2) — a run of several blank lines carries no extra meaning
		// over a single paragraph break, just extra stored lineCount.
		const trimmedDescription = description.trim().replace(/\n{3,}/g, "\n\n");
		// A continuation line shaped like a real Timeline/To-Do line would be
		// misread as a new top-level item on the next parse instead of staying
		// part of this description (AGENTS.md 1.4.2) — reject rather than
		// silently losing it.
		const continuationLines = trimmedDescription.split("\n").slice(1);
		if (continuationLines.some((line) => isTopLevelOrMarker(line))) {
			new Notice(t("multilineContinuationError", language));
			return;
		}
		onSave({ start, end, category, description: trimmedDescription });
	};

	return (
		<div className="dwl-modal-body">
			<div className="dwl-modal-field">
				<label className="dwl-modal-label">{t("lblTimeSet", language)}</label>
				<div className="dwl-modal-time-row">
					<input
						className="dwl-modal-time-input"
						type="text"
						placeholder="09:00"
						value={start}
						onChange={(e) => setStart(e.target.value)}
						onKeyDown={(e) => e.stopPropagation()}
					/>
					<input
						className="dwl-modal-time-input"
						type="text"
						placeholder="10:00"
						value={end}
						onChange={(e) => setEnd(e.target.value)}
						onKeyDown={(e) => e.stopPropagation()}
					/>
				</div>
			</div>

			<div className="dwl-modal-field">
				<label className="dwl-modal-label">{t("fieldCategory", language)}</label>
				<div className="dwl-category-chips">
					{categories.map((cat) => (
						<button
							type="button"
							key={cat.name}
							className={`dwl-category-chip${category === cat.displayName ? " is-selected" : ""}`}
							onClick={() => setCategory(category === cat.displayName ? undefined : cat.displayName)}
						>
							<span className="dwl-category-chip-preview" style={{ backgroundColor: cat.color }} />
							<span>{cat.displayName}</span>
						</button>
					))}
				</div>
			</div>

			<div className="dwl-modal-field">
				<label className="dwl-modal-label">{t("lblContent", language)}</label>
				<textarea
					className="dwl-modal-textarea"
					rows={3}
					placeholder={t("descPlaceholder", language)}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					onKeyDown={(e) => e.stopPropagation()}
				/>
			</div>

			<div className="dwl-modal-buttons">
				{onDelete && (
					<button type="button" className="dwl-modal-btn-delete" onClick={onDelete}>
						{t("btnDelete", language)}
					</button>
				)}
				<button type="button" className="dwl-modal-btn-cancel" onClick={onCancel}>
					{t("btnCancel", language)}
				</button>
				<button type="button" className="dwl-modal-btn-save" onClick={handleSave}>
					{t("btnSave", language)}
				</button>
			</div>
		</div>
	);
}

/**
 * Add/edit modal for Event (Timeline) items — content is a React tree, but
 * the modal shell itself is still a plain Obsidian `Modal` (design.md §3:
 * modals always follow the SYSTEM theme via Canvas/CanvasText, independent
 * of whichever framework renders their content). The title uses Obsidian's
 * own native title bar (`this.titleEl`) rather than a custom in-content
 * heading — matches DayTime Tracker's TimelineModal structure exactly.
 */
export class TimelineModal extends Modal {
	private root: Root | null = null;

	constructor(
		app: App,
		private readonly language: MarkerLanguage,
		private readonly categories: CustomCategory[],
		private readonly initial: TimelineItem | null,
		private readonly defaultStart: string,
		private readonly defaultEnd: string,
		private readonly onSave: (values: EventEntryValues) => void,
		private readonly onRequestDelete: (() => void) | null
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.containerEl.addClass("dwl-event-modal");
		this.titleEl.setText(this.initial ? t("modalEditTitle", this.language) : t("modalAddTitle", this.language));

		this.root = createRoot(contentEl);
		this.root.render(
			<TimelineModalContent
				language={this.language}
				categories={this.categories}
				initial={this.initial}
				defaultStart={this.defaultStart}
				defaultEnd={this.defaultEnd}
				onSave={(values) => {
					this.onSave(values);
					this.close();
				}}
				onDelete={
					this.onRequestDelete
						? () => {
								this.close();
								this.onRequestDelete?.();
							}
						: null
				}
				onCancel={() => this.close()}
			/>
		);
	}

	onClose(): void {
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
		this.contentEl.empty();
	}
}
