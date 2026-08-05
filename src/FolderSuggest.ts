import { AbstractInputSuggest, App, TFolder } from "obsidian";

/**
 * Folder-path autocomplete for the "일일노트 저장 폴더" setting (AGENTS.md §2),
 * ported from DayTime Tracker's FolderSuggest. Root is offered as "/" but
 * resolves to "" (empty string = vault root, DailyWorkLogSettings.dailyNoteFolder's default).
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(
		app: App,
		private readonly inputEl: HTMLInputElement
	) {
		super(app, inputEl);
		this.onSelect((folder) => {
			this.setValue(folder.path === "/" ? "" : folder.path);
			this.inputEl.trigger("input");
			this.close();
		});
	}

	getSuggestions(query: string): TFolder[] {
		const lowerQuery = query.toLowerCase();
		const folders: TFolder[] = [];
		const collect = (folder: TFolder): void => {
			if (folder.path === "/" || folder.path.toLowerCase().contains(lowerQuery)) {
				folders.push(folder);
			}
			for (const child of folder.children) {
				if (child instanceof TFolder) collect(child);
			}
		};
		collect(this.app.vault.getRoot());
		return folders;
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path === "/" ? "/" : folder.path);
	}
}
