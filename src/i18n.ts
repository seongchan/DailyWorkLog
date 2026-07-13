import type { MarkerLanguage } from "./parser";

/**
 * UI display strings — a separate concern from marker parsing (parser.ts
 * MARKER_LABELS). The parser always recognizes every supported language's
 * markers regardless of settings (AGENTS.md 1.3); this table instead governs
 * what the sidebar itself displays, and follows the single configured
 * language only. See design.md §9.
 */
export type UIStringKey =
	| "sectionEvent"
	| "sectionTodo"
	| "btnAdd"
	| "btnToday"
	| "todoPlaceholder"
	| "modalAddTitle"
	| "modalEditTitle"
	| "lblTimeSet"
	| "lblContent"
	| "descPlaceholder"
	| "btnSave"
	| "btnCancel"
	| "btnDelete"
	| "btnCreate"
	| "confirmTitle"
	| "confirmDeleteTask"
	| "confirmDeleteEvent"
	| "confirmOk"
	| "emptyEvent"
	| "emptyTodo"
	| "headerToday"
	| "noActiveNote"
	| "noDescription"
	| "noteNotFoundConfirm"
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
	| "dashboardEmptyVault";

export const STRINGS: Record<MarkerLanguage, Record<UIStringKey, string>> = {
	en: {
		sectionEvent: "⏱ Event",
		sectionTodo: "☑ To-Do",
		btnAdd: "+ Add",
		btnToday: "Today",
		todoPlaceholder: "Add new task... (Enter)",
		modalAddTitle: "What did you do?",
		modalEditTitle: "Edit Event",
		lblTimeSet: "Time",
		lblContent: "Content",
		descPlaceholder: "Enter details (optional).",
		btnSave: "Save",
		btnCancel: "Cancel",
		btnDelete: "Delete",
		btnCreate: "Create",
		confirmTitle: "Notice",
		confirmDeleteTask: "Delete '%s'?",
		confirmDeleteEvent: "Delete this event?",
		confirmOk: "OK",
		emptyEvent: "No events recorded.",
		emptyTodo: "No tasks yet.",
		headerToday: "Today",
		noActiveNote: "Select a date on the calendar, or open a daily note.",
		noDescription: "(no description)",
		noteNotFoundConfirm: "%s doesn't exist. Create it?",
		invalidTimeFormat: "Please check the time format (e.g. 09:00).",
		dashboardTitle: "Dashboard",
		btnRefresh: "Refresh",
		statTotalNotes: "Total Notes",
		statStreak: "Current Streak",
		statDateRange: "Date Range",
		statTodoRate: "To-Do Completion (30d)",
		statEventTime: "Event Time (30d)",
		unitDays: " days",
		recentNotesTitle: "Recent Notes",
		dashboardEmptyVault: "No daily notes yet.",
	},
	ko: {
		sectionEvent: "⏱ 이벤트",
		sectionTodo: "☑ 할 일",
		btnAdd: "+ 추가",
		btnToday: "오늘",
		todoPlaceholder: "새로운 할 일 추가... (Enter)",
		modalAddTitle: "무엇을 했나요?",
		modalEditTitle: "이벤트 수정",
		lblTimeSet: "시간 설정",
		lblContent: "내용",
		descPlaceholder: "상세 내용을 입력해 주세요.",
		btnSave: "저장",
		btnCancel: "취소",
		btnDelete: "삭제",
		btnCreate: "생성",
		confirmTitle: "알림",
		confirmDeleteTask: "'%s' 할 일을 삭제하시겠습니까?",
		confirmDeleteEvent: "이 이벤트를 삭제하시겠습니까?",
		confirmOk: "확인",
		emptyEvent: "기록이 없습니다.",
		emptyTodo: "할 일이 없습니다.",
		headerToday: "오늘",
		noActiveNote: "달력에서 날짜를 선택하거나 일일 노트를 여세요.",
		noDescription: "(설명 없음)",
		noteNotFoundConfirm: "%s 파일이 없습니다. 새로 생성할까요?",
		invalidTimeFormat: "시간 형식을 확인하세요 (예: 09:00).",
		dashboardTitle: "대시보드",
		btnRefresh: "새로고침",
		statTotalNotes: "총 노트 수",
		statStreak: "연속 작성일",
		statDateRange: "기록 기간",
		statTodoRate: "최근 30일 할 일 완료율",
		statEventTime: "최근 30일 기록 시간",
		unitDays: "일",
		recentNotesTitle: "최근 노트",
		dashboardEmptyVault: "아직 작성된 일일 노트가 없습니다.",
	},
};

/** Weekday header labels for the Calendar grid (Sun..Sat), per language. */
export const WEEKDAYS: Record<MarkerLanguage, string[]> = {
	en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
	ko: ["일", "월", "화", "수", "목", "금", "토"],
};

export function t(key: UIStringKey, language: MarkerLanguage): string {
	return STRINGS[language][key];
}
