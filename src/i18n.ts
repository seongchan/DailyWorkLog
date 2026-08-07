import type { MarkerLanguage } from "./parser";

/**
 * UI display strings — a separate concern from marker parsing (parser.ts
 * MARKER_LABELS). The parser always recognizes every supported language's
 * markers regardless of settings (AGENTS.md 1.3); this table instead governs
 * what the sidebar itself displays, and follows the single configured
 * language only. See design.md §9.
 *
 * Values are kept in exact parity with DayTime Tracker's own locale/en.ts
 * and locale/ko.ts wherever a directly corresponding string exists — the
 * user wants the two plugins to look identical apart from the storage
 * mechanism (frontmatter vs. body text), so wording here isn't ours to
 * improvise on.
 */
export type UIStringKey =
	| "ribbonOpenSidebar"
	| "ribbonOpenDashboard"
	| "commandOpenSidebar"
	| "commandOpenDashboard"
	| "todoPlaceholder"
	| "modalAddTitle"
	| "modalEditTitle"
	| "lblTimeSet"
	| "lblContent"
	| "fieldCategory"
	| "uncategorized"
	| "descPlaceholder"
	| "btnSave"
	| "btnCancel"
	| "btnDelete"
	| "todayNoteButton"
	| "createTodayNoteButton"
	| "exportPdfButton"
	| "exportPdfDesc"
	| "exportSuccess"
	| "printButton"
	| "todayTodosTitle"
	| "confirmTitle"
	| "confirmDeleteTask"
	| "confirmDeleteEvent"
	| "confirmOk"
	| "emptyTodo"
	| "emptyStateTitleNoNote"
	| "emptyStateDescNoNote"
	| "emptyStateTitleNotDaily"
	| "invalidTimeFormat"
	| "dashboardTitle"
	| "btnRefresh"
	| "statTotalNotes"
	| "statStreak"
	| "statDateRange"
	| "statTodoRate"
	| "statEventTime"
	| "unitDays"
	| "recentNotesTitle"
	| "dashboardEmptyVault"
	| "settingsTitle"
	| "settingGeneralSection"
	| "settingStartHourName"
	| "settingStartHourDesc"
	| "settingEndHourName"
	| "settingEndHourDesc"
	| "settingFolderName"
	| "settingFolderDesc"
	| "settingFolderPlaceholder"
	| "settingLanguageName"
	| "settingLanguageDesc"
	| "alertStartBeforeEnd"
	| "alertEndAfterStart"
	| "settingThemeModeName"
	| "settingThemeModeDesc"
	| "themeModeLight"
	| "themeModeDark"
	| "settingCategoriesSection"
	| "settingCategoriesDesc"
	| "settingResetCategoriesName"
	| "settingResetCategoriesDesc"
	| "btnReset"
	| "noticeResetCategories"
	| "settingCatDisplayNamePlaceholder"
	| "settingAddCategoryName"
	| "settingAddCategoryDesc"
	| "settingAddCategoryPlaceholder"
	| "btnAdd"
	| "alertCatNameEmpty"
	| "alertCatLimitMax"
	| "alertCatNameExists"
	| "window7Days"
	| "window30Days"
	| "window90Days"
	| "windowAllTime"
	| "statAvgPerDay"
	| "statTopCategory"
	| "statTopCategoryPct"
	| "categoryDistTitle"
	| "periodSummaryTitle"
	| "activityNotesTitle";

export const STRINGS: Record<MarkerLanguage, Record<UIStringKey, string>> = {
	en: {
		ribbonOpenSidebar: "Open DailyWorkLog",
		ribbonOpenDashboard: "Open Work Insights",
		commandOpenSidebar: "Open sidebar",
		commandOpenDashboard: "Open Work Insights",
		todoPlaceholder: "Add a new to-do... (Enter)",
		modalAddTitle: "What did you do?",
		modalEditTitle: "Edit Daily Activity",
		lblTimeSet: "Time Setting",
		lblContent: "Content",
		fieldCategory: "Category",
		uncategorized: "Uncategorized",
		descPlaceholder: "Enter detailed content.",
		btnSave: "Save",
		btnCancel: "Cancel",
		btnDelete: "Delete",
		todayNoteButton: "Today",
		createTodayNoteButton: "Create today's daily note",
		exportPdfButton: "Print",
		exportPdfDesc: "Export timeline to a printable HTML file.",
		exportSuccess: "Timeline HTML file has been generated. Open it in a browser to save as PDF!",
		printButton: "Save as PDF / Print",
		todayTodosTitle: "Today's To-Dos",
		confirmTitle: "Notice",
		confirmDeleteTask: "Are you sure you want to delete the to-do '%s'?",
		confirmDeleteEvent: "Delete this event?",
		confirmOk: "Confirm",
		emptyTodo: "No to-dos for today.",
		emptyStateTitleNoNote: "No note open",
		emptyStateDescNoNote: "Please select an active note to view or edit logs.",
		emptyStateTitleNotDaily: "Not a daily note",
		invalidTimeFormat: "Invalid time format. (e.g. 09:00)",
		dashboardTitle: "Work Insights",

		btnRefresh: "Refresh",
		statTotalNotes: "Total Notes",
		statStreak: "Current Streak",
		statDateRange: "Date Range",
		statTodoRate: "To-Do Completion (30d)",
		statEventTime: "Event Time (30d)",
		unitDays: " days",
		recentNotesTitle: "Recent Notes",
		dashboardEmptyVault: "No daily notes yet.",
		settingsTitle: "Daily Work Log Settings",
		settingGeneralSection: "General",
		settingStartHourName: "Day Start Hour",
		settingStartHourDesc: "Set the start hour to display on the timeline.",
		settingEndHourName: "Day End Hour",
		settingEndHourDesc: "Set the end hour to display on the timeline. (Supports up to midnight 24:00)",
		settingFolderName: "Daily Note Folder",
		settingFolderDesc: "Folder where today's daily note will be created. Leave empty to use the vault root.",
		settingFolderPlaceholder: "Vault root",
		settingLanguageName: "Language",
		settingLanguageDesc:
			"Display language for the Event/ToDo/Diary markers inserted into new daily notes. " +
			"Changing it never breaks markers already written in another language in existing files.",
		alertStartBeforeEnd: "Start hour must be earlier than end hour.",
		alertEndAfterStart: "End hour must be later than start hour.",
		settingThemeModeName: "Background Theme Mode",
		settingThemeModeDesc: "Select the background color theme for the sidebar view. (Popups always follow the system theme.)",
		themeModeLight: "Light",
		themeModeDark: "Dark",
		settingCategoriesSection: "Category Management",
		settingCategoriesDesc: "Customize the categories and colors used in your daily logs.",
		settingResetCategoriesName: "Reset Default Categories",
		settingResetCategoriesDesc: "Reset all categories and colors to the default pastel values.",
		btnReset: "Reset",
		noticeResetCategories: "Categories reset to default values.",
		settingCatDisplayNamePlaceholder: "Display Name",
		settingAddCategoryName: "Add New Category",
		settingAddCategoryDesc: "Enter a name (max 10 chars) and pick a color to add a new category.",
		settingAddCategoryPlaceholder: "Category Name",
		btnAdd: "Add",
		alertCatNameEmpty: "Please enter a category name.",
		alertCatLimitMax: "You cannot have more than 10 categories.",
		alertCatNameExists: "This category name already exists.",
		window7Days: "Last 7 Days",
		window30Days: "Last 30 Days",
		window90Days: "Last 90 Days",
		windowAllTime: "All Time",
		statAvgPerDay: "Daily Avg",
		statTopCategory: "Top Category",
		statTopCategoryPct: "%s% of recorded time",
		categoryDistTitle: "Time Distribution by Category",
		periodSummaryTitle: "Period Summary",
		activityNotesTitle: "Recent Note Activities",
	},

	ko: {
		ribbonOpenSidebar: "DailyWorkLog 열기",
		ribbonOpenDashboard: "DailyWorkLog 일과 인사이트 열기",
		commandOpenSidebar: "사이드바 열기",
		commandOpenDashboard: "일과 인사이트 열기",
		todoPlaceholder: "새로운 할 일 추가... (Enter)",
		modalAddTitle: "무엇을 했나요?",
		modalEditTitle: "일과 수정",
		lblTimeSet: "시간 설정",
		lblContent: "내용",
		fieldCategory: "카테고리",
		uncategorized: "미분류",
		descPlaceholder: "상세 내용을 입력해 주세요.",
		btnSave: "저장",
		btnCancel: "취소",
		btnDelete: "삭제",
		todayNoteButton: "오늘",
		createTodayNoteButton: "오늘의 데일리 노트 생성",
		exportPdfButton: "인쇄",
		exportPdfDesc: "타임라인을 PDF/인쇄용 HTML 파일로 내보냅니다.",
		exportSuccess: "타임라인 인쇄용 HTML 파일이 생성되었습니다. 브라우저 창에서 PDF로 저장하세요!",
		printButton: "PDF로 저장 / 인쇄하기",
		todayTodosTitle: "오늘 할 일",
		confirmTitle: "알림",
		confirmDeleteTask: "'%s' 할 일을 삭제하시겠습니까?",
		confirmDeleteEvent: "이 이벤트를 삭제하시겠습니까?",
		confirmOk: "확인",
		emptyTodo: "등록된 오늘 할 일이 없습니다.",
		emptyStateTitleNoNote: "선택된 노트가 없습니다",
		emptyStateDescNoNote: "일과를 기록하고 조회하려면 활성화된 노트를 선택해 주세요.",
		emptyStateTitleNotDaily: "날짜 노트가 아닙니다",
		invalidTimeFormat: "시간 형식이 올바르지 않습니다. (예: 09:00)",
		dashboardTitle: "일과 인사이트",

		btnRefresh: "새로고침",
		statTotalNotes: "총 노트 수",
		statStreak: "연속 작성일",
		statDateRange: "기록 기간",
		statTodoRate: "최근 30일 할 일 완료율",
		statEventTime: "최근 30일 기록 시간",
		unitDays: "일",
		recentNotesTitle: "최근 노트",
		dashboardEmptyVault: "아직 작성된 일일 노트가 없습니다.",
		settingsTitle: "Daily Work Log 설정",
		settingGeneralSection: "일반",
		settingStartHourName: "하루 시작 시간",
		settingStartHourDesc: "타임라인에 표시할 시작 시간(시)을 설정합니다.",
		settingEndHourName: "하루 종료 시간",
		settingEndHourDesc: "타임라인에 표시할 종료 시간(시)을 설정합니다. (자정 24:00까지 지원)",
		settingFolderName: "날짜 노트 생성 폴더",
		settingFolderDesc: "'오늘' 버튼으로 노트를 생성할 때 사용할 폴더를 지정합니다. 비워두면 볼트 최상위 폴더에 생성됩니다.",
		settingFolderPlaceholder: "볼트 최상위 폴더",
		settingLanguageName: "언어",
		settingLanguageDesc:
			"새 일일 노트를 생성할 때 삽입되는 Event/ToDo/Diary 마커의 표시 언어입니다. " +
			"언어를 바꿔도 기존 파일에 쓰인 다른 언어 마커는 계속 인식됩니다.",
		alertStartBeforeEnd: "시작 시간은 종료 시간보다 빨라야 합니다.",
		alertEndAfterStart: "종료 시간은 시작 시간보다 늦어야 합니다.",
		settingThemeModeName: "배경 테마 설정",
		settingThemeModeDesc: "사이드바 화면의 배경색 테마를 선택합니다. (팝업/모달은 항상 시스템 테마를 따릅니다)",
		themeModeLight: "라이트",
		themeModeDark: "다크",
		settingCategoriesSection: "카테고리 설정",
		settingCategoriesDesc: "일과 기록에 사용할 카테고리와 색상을 관리합니다.",
		settingResetCategoriesName: "기본 카테고리 색상 재설정",
		settingResetCategoriesDesc: "카테고리와 색상을 원래의 파스텔톤 기본값으로 재설정합니다.",
		btnReset: "재설정",
		noticeResetCategories: "카테고리가 기본값으로 재설정되었습니다.",
		settingCatDisplayNamePlaceholder: "표시 이름",
		settingAddCategoryName: "새 카테고리 추가",
		settingAddCategoryDesc: "새 카테고리 이름(최대 10자)과 색상을 지정하여 추가합니다.",
		settingAddCategoryPlaceholder: "카테고리 이름 입력...",
		btnAdd: "추가",
		alertCatNameEmpty: "카테고리 이름을 입력해 주세요.",
		alertCatLimitMax: "카테고리는 최대 10개까지 등록할 수 있습니다.",
		alertCatNameExists: "이미 존재하는 카테고리 이름입니다.",
		window7Days: "최근 7일",
		window30Days: "최근 30일",
		window90Days: "최근 90일",
		windowAllTime: "전체 기간",
		statAvgPerDay: "일평균 기록",
		statTopCategory: "최다 활동 카테고리",
		statTopCategoryPct: "전체 기록 시간의 %s%",
		categoryDistTitle: "카테고리별 기록 시간 분포",
		periodSummaryTitle: "기간 요약",
		activityNotesTitle: "최근 일간 노트 작업 내역",
	},
};

/** Weekday header labels, per language (Sun-first, index by Date#getDay()). */
export const WEEKDAYS: Record<MarkerLanguage, string[]> = {
	en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
	ko: ["일", "월", "화", "수", "목", "금", "토"],
};

export function t(key: UIStringKey, language: MarkerLanguage): string {
	return STRINGS[language][key];
}
