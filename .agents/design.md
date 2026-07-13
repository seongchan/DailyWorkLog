# Daily Work Log — UI/UX 디자인 가이드

> 이 문서는 플러그인 UI 구현 시 참조하는 디자인 원칙과 컴포넌트 스펙을 정리합니다.
> 코드 구조/아키텍처 결정은 [`implementation_plan.md`](../ref_docs/implementation_plan.md)를 참조하세요.
> 전체 개발 규칙은 [`AGENTS.md`](./AGENTS.md)를 참조하세요.

---

## 디자인 원칙

1. **파스텔톤 컬러** — 쨍한 원색 대신 저채도 소프트 파스텔로 눈의 피로도를 줄입니다.
2. **저채도 버튼** — Obsidian 기본 `.mod-cta`(파란색 강조) 대신 무채색 계열 3종으로 통일합니다.
3. **미니멀 삭제 버튼** — 평소엔 투명, hover 시에만 빨간 텍스트로 노출합니다.
4. **팝업은 시스템 테마를 따름** *(변경)* — ~~라이트/다크 테마와 무관하게 흰색 배경 고정~~에서 변경. CSS `Canvas`/`CanvasText` 시스템 색상을 사용해 라이트/다크 테마에 따라 자동 전환됩니다. 자세한 내용은 §3 참조.
5. **Obsidian CSS 변수 우선 (대시보드 한정)** *(범위 조정)* — 중앙 대시보드 뷰는 `--text-normal`, `--background-secondary` 등 Obsidian 변수를 그대로 사용해 테마 호환성을 유지합니다. **사이드바는 이 원칙에서 제외** — §10 참조.
6. **다국어 지원 (EN / KO)** *(추가)* — 기본값 English, 플러그인 설정에서 전환. 파서는 항상 두 언어 마커를 동시에 인식하므로(AGENTS.md 1.3) UI 문구도 이와 별개로 설정된 언어에 따라 전환됩니다. 자세한 내용은 §9 참조.
7. **사이드바 전용 라이트/다크 테마** *(추가)* — 사이드바 색상은 Obsidian 전체 테마와 무관하게 플러그인 자체 설정("라이트"/"다크")으로 전환됩니다. 모달(원칙 4)과 대시보드(원칙 5)는 각각 다른 테마 규칙을 따르므로 셋을 혼동하지 않도록 유의합니다. 자세한 내용은 §10 참조.

---

## 1. 사이드바 인라인 입력 기능

> 편집기(마크다운 원본)를 열지 않고도, **오른쪽 사이드바에서 직접** To-Do를 추가하고 타임라인 항목을 기록할 수 있는 인터페이스.
> 디자인 기준: `DayTimeTracker_internal/ref_docs/designSample/color-palette-mockup.html`

### 1.1 기능 범위

| 기능 | 진입 방법 | 결과 |
|---|---|---|
| **To-Do 항목 추가** | To-Do 섹션 하단 인라인 입력창에서 텍스트 입력 후 Enter | `- [ ] 텍스트` 를 파일 `# _ToDo` 블록 끝에 추가 |
| **To-Do 항목 삭제** | 항목 hover 시 나타나는 ✕ 버튼 클릭 → 확인 팝업 | 해당 라인을 파일에서 제거 |
| **타임라인 항목 추가** | 타임라인 섹션의 "+ 추가" 버튼 클릭 → 모달 | `- HH:mm - HH:mm 설명` 을 `# _Event` 블록 끝에 추가 |
| **타임라인 항목 수정/삭제** | 기존 항목 클릭 → 수정 모달 | 해당 라인을 수정 또는 제거 |

> [!NOTE]
> 파일 쓰기는 항상 `plugin.writeFile()` (main.ts) 경유 — 자기-수정 이벤트 가드 포함 (AGENTS.md §3)

---

## 2. 컬러 시스템

### 2.1 카테고리 파스텔 팔레트

```css
/* styles.css — .dwl-view 스코프 내 변수 */
--dwl-c-work:          #d0e1fd;  /* Pastel Blue  */
--dwl-c-work-text:     #1e3a8a;  /* Deep Blue    */

--dwl-c-study:         #ebd3f8;  /* Pastel Purple */
--dwl-c-study-text:    #581c87;  /* Deep Purple  */

--dwl-c-rest:          #d1f2e5;  /* Pastel Green */
--dwl-c-rest-text:     #064e3b;  /* Deep Green   */

--dwl-c-reading:       #fdecd0;  /* Pastel Orange */
--dwl-c-reading-text:  #7c2d12;  /* Deep Orange  */

--dwl-c-exercise:      #e2e5e9;  /* Pastel Slate Gray */
--dwl-c-exercise-text: #1e293b;  /* Deep Slate   */
```

### 2.2 액션 버튼 3종

| 역할 | 배경 | 텍스트 | 테두리 | hover 배경 |
|---|---|---|---|---|
| **저장/확인** | `#e2e8f0` | `#1e293b` | `#64748b` | `#cbd5e1` |
| **취소** | `transparent` | `#475569` | `#cbd5e1` | `#f1f5f9` |
| **삭제** | `transparent` | `#991b1b` | `#fca5a5` | `#fee2e2` |

> [!IMPORTANT]
> `.mod-cta` (Obsidian 기본 파란색 버튼)는 사용하지 않습니다. 모든 버튼은 저채도 계열로 통일합니다.

---

## 3. 모달 스타일 원칙

> [!IMPORTANT]
> *(변경)* 이전 안(흰색 배경 고정)을 폐기하고, 시스템 테마를 따르도록 변경했습니다. 사이드바 본체는 Obsidian 테마 변수(`--background-secondary` 등)를 쓰지만, 모달은 사이드바보다 더 범용적인 **시스템 레벨** 라이트/다크 신호(`Canvas`/`CanvasText`)를 사용합니다 — Obsidian 창 자체가 OS 다크모드를 따르지 않는 environments에서도 모달이 항상 읽기 가능한 대비를 유지하기 위함입니다.

- **배경**: `Canvas` (시스템 배경색) — 라이트/다크 테마에 따라 자동 전환
- **텍스트/타이틀**: `CanvasText` (시스템 텍스트색), 타이틀은 `font-weight: 700`, `font-size: 14~15px`
- **테두리**: `rgba(0,0,0,0.1)` (그림자와 함께 배경과의 경계를 미세하게 표시)
- **입력 필드 테두리**: 기본 `rgba(0,0,0,0.18)`, focus 시 `#a0aec0`
- **textarea**: 세로 resize만 허용 (`resize: vertical; min-height: 48px; max-height: 90px`)
- **등장 애니메이션**: `slideUp` — 14px 아래에서 위로, 0.25s, `cubic-bezier(0.16, 1, 0.3, 1)`
- **dim 오버레이**: `rgba(0, 0, 0, 0.4)`, `fadeIn` 0.2s
- **너비**: 이벤트 모달 `260px`, 확인 팝업 `230px` (둘 다 `max-width: calc(100% - 24px)`로 사이드바 폭 초과 방지)

---

## 4. 컴포넌트 레이아웃

### 4.1 To-Do 섹션

```
┌─────────────────────────────────────────┐
│ 오늘 할 일   3개                         │  ← 섹션 헤더
├─────────────────────────────────────────┤
│ [새로운 할 일 추가... (Enter)]            │  ← 인라인 input (상단 고정)
│                                         │
│  ☑  업무 회의 준비하기 (strikethrough)  ✕│  ← 완료 항목
│  ☐  독서 1시간 하기                     ✕│  ← hover시 ✕ 노출
│  ☐  가벼운 스트레칭                     ✕│
└─────────────────────────────────────────┘
```

**인라인 input 동작**
- `Enter` → 텍스트가 있으면 `- [ ] 텍스트` 파일에 append → input 초기화
- `Escape` / blur → 취소, input 초기화
- 빈 문자열 Enter → 무시

**✕ 삭제 버튼 동작**
- 평소: `opacity: 0`, 배경 없음
- item hover: `opacity: 1`, 텍스트 색 `#bfbfbf`
- 버튼 hover: 텍스트 색 `#ef4444` (배경 변화 없음)
- 클릭: 확인 팝업 호출

### 4.2 타임라인 항목 추가/수정 모달

```
┌─────────────────────────────────────────┐
│ 무엇을 했나요?                           │  ← 타이틀 (검은색)
├─────────────────────────────────────────┤
│ 시간 설정                               │
│ [09:00]           [10:00]              │  ← 시작 / 종료
│                                         │
│ 내용                                    │
│ [상세 내용을 입력해 주세요.             ]│  ← textarea (세로 resize)
│                                         │
│ [삭제]                 [취소]   [저장]  │
└─────────────────────────────────────────┘
```

| 필드 | 타입 | 형식 | 검증 |
|---|---|---|---|
| 시작 시간 | `<input type="text">` | `HH:mm` | `parser.ts`의 `TIME_VALUE_REGEX` (시 00-23, 분 00-59 범위까지 확인 — 자릿수만 보는 `/\d{1,2}:\d{2}/`은 `99:99`도 통과시켜서 폐기) |
| 종료 시간 | `<input type="text">` | `HH:mm` | 위와 동일 |
| 내용 | `<textarea>` | 자유 텍스트 | 없음 (빈 값 허용) |

- **삭제 버튼**: 신규 추가 시 숨김, 수정 시 표시
- **저장 결과**: `- HH:mm - HH:mm 내용` 형식으로 `# _Event` 블록 끝에 추가
- **수정**: 해당 라인 in-place 교체 (라인 인덱스 재검증 후)

### 4.3 확인 팝업

```
┌────────────────────────────┐
│ 알림                        │  ← 검은색 타이틀, font-size: 14px
│                            │
│ '독서 1시간 하기' 할 일을   │  ← font-size: 12px, color: #4a5568
│ 삭제하시겠습니까?           │
│                            │
│              [취소]  [확인] │
└────────────────────────────┘
```

- 너비: `280px`
- Obsidian `Modal` 클래스 상속 → `src/modals/` 하위에 신설

---

## 5. 사이드바 레이아웃 변경

**현재**
```
Calendar
├── 타임라인 목록 (읽기 전용)
└── To-Do 목록 (체크박스 토글만)
```

**변경 후**
```
Calendar
├── 타임라인 섹션
│   ├── 헤더("_Event") + [+ 추가] 버튼
│   ├── 항목 목록 (클릭 → 수정 모달)
│   └── 빈 상태 메시지
└── To-Do 섹션
    ├── 헤더("_ToDo") + 개수 표시
    ├── 인라인 입력창 (상단 고정)
    └── 항목 목록 (체크박스 + ✕ 버튼)
```

---

## 6. CSS 클래스 네이밍

기존 `dwl-*` prefix 유지, 신규 클래스 추가:

| 클래스 | 설명 |
|---|---|
| `dwl-section` | 타임라인/To-Do 공통 섹션 wrapper |
| `dwl-section-header` | 섹션 헤더 행 (제목 + 버튼) |
| `dwl-section-add-btn` | "+ 추가" 버튼 |
| `dwl-todo-input-wrap` | To-Do 인라인 입력창 wrapper |
| `dwl-todo-input` | 실제 `<input>` 엘리먼트 |
| `dwl-todo-delete-btn` | ✕ 삭제 버튼 |
| `dwl-timeline-item` | 타임라인 개별 항목 (클릭 가능) |
| `dwl-modal-time-input` | 모달 내 시간 입력 필드 |
| `dwl-modal-btn-save` | 저장/확인 버튼 |
| `dwl-modal-btn-cancel` | 취소 버튼 |
| `dwl-modal-btn-delete` | 삭제 버튼 |

---

## 7. 파일 쓰기 안전성 체크리스트

> [!IMPORTANT]
> 모든 쓰기 작업(추가/수정/삭제)은 아래 순서를 반드시 따릅니다.

1. `app.vault.read(currentFile)` — 최신 내용 재읽기
2. 라인 인덱스 재검증 — `lines[item.line]`이 기대값과 일치하는지 확인
3. 불일치 시 → 쓰기 중단, `refresh()` 호출 (UI 재동기화)
4. `plugin.writeFile(file, newContent)` — self-trigger 가드 포함
5. `refresh()` 호출

---

## 8. 구현 단계 (우선순위 순)

| 단계 | 작업 | 영향 파일 | 상태 |
|---|---|---|---|
| **1** | `src/i18n.ts` — EN/KO 문구 테이블 + `t()` 헬퍼 | `src/i18n.ts` | ✅ 완료 |
| **2** | To-Do 인라인 추가 입력창 | `components/TodoList.ts`, `view.ts`, `styles.css` | ✅ 완료 |
| **3** | To-Do ✕ 삭제 + 확인 팝업 | `components/TodoList.ts`, `modals/ConfirmDeleteModal.ts` | ✅ 완료 |
| **4** | 타임라인 "+ 추가" 모달 | `modals/EventEntryModal.ts`, `components/Timeline.ts` | ✅ 완료 |
| **5** | 타임라인 항목 클릭 → 수정 모달 | `components/Timeline.ts`, `modals/EventEntryModal.ts` | ✅ 완료 |
| **6** | CSS 스타일 전체 적용 | `styles.css` | ✅ 완료 |

각 단계는 독립적으로 빌드/테스트 가능합니다. (모달 파일명은 `_TimeTracker Line` → `_Event` 마커 개명과 일관되게 `EventEntryModal.ts`로 통일 — `task.md`에도 이미 이 이름으로 반영되어 있음)

> [!NOTE]
> 코드 구현 시 §7 체크리스트(재읽기 → 라인 재검증 → 불일치 시 중단 → 쓰기 → refresh)를 재사용 가능한 순수 함수로 뽑아냈습니다: `parser.ts`의 `todoLineMatches` / `timelineLineMatches`(2번 항목: 라인 재검증)와 `appendLineToBlock` / `replaceLineAt` / `removeLineAt`(추가/수정/삭제 자체). 전부 Obsidian API 의존성 없이 유닛 테스트됩니다 (`parser.test.ts`).

---

## 9. 다국어(i18n) UI 문구

> 파서의 마커 다국어 인식(AGENTS.md 1.3)과는 **별개의 관심사**입니다. 파서는 항상 EN/KO 마커를 동시에 인식하지만, 여기서 다루는 건 사이드바에 표시되는 **화면 문구**(버튼 라벨, 섹션 제목, 플레이스홀더, 모달 문구 등)이며 이건 설정된 언어 하나만 따라갑니다.

### 9.1 구조

- `src/i18n.ts`: `STRINGS: Record<"en" | "ko", Record<string, string>>` 상수와 `t(key: string): string` 헬퍼를 정의. `t()`는 `plugin.settings.language`를 참조해 현재 언어의 문자열을 반환.
- 언어 설정(`SettingTab.ts`)이 바뀌면 사이드바가 재렌더링되어야 함 (`view.ts`의 설정 변경 리스너 또는 `refresh()` 재사용).
- `%s` 같은 자리표시자가 있는 문구(`confirmDeleteTask`)는 `t(key).replace('%s', value)` 형태로 치환.

### 9.2 문구 키 테이블 (mockup 기준)

| Key | EN | KO |
|---|---|---|
| `sectionEvent` | ⏱ Event | ⏱ 이벤트 |
| `sectionTodo` | ☑ To-Do | ☑ 할 일 |
| `btnAdd` | + Add | + 추가 |
| `btnToday` | Today | 오늘 |
| `todoPlaceholder` | Add new task... (Enter) | 새로운 할 일 추가... (Enter) |
| `modalAddTitle` | What did you do? | 무엇을 했나요? |
| `modalEditTitle` | Edit Event | 이벤트 수정 |
| `lblTimeSet` | Time | 시간 설정 |
| `lblContent` | Content | 내용 |
| `descPlaceholder` | Enter details (optional). | 상세 내용을 입력해 주세요. |
| `btnSave` | Save | 저장 |
| `btnCancel` | Cancel | 취소 |
| `btnDelete` | Delete | 삭제 |
| `confirmTitle` | Notice | 알림 |
| `confirmDeleteTask` | Delete '%s'? | '%s' 할 일을 삭제하시겠습니까? |
| `confirmDeleteEvent` | Delete this event? | 이 이벤트를 삭제하시겠습니까? |
| `confirmOk` | OK | 확인 |
| `emptyEvent` | No events recorded. | 기록이 없습니다. |
| `headerToday` | Today | 오늘 |

기본 언어는 English(`"en"`, `settings.ts`의 `DEFAULT_SETTINGS`와 동일).

> [!NOTE]
> 실제 구현 시 위 표에 없던 항목(`emptyTodo`, `noActiveNote`, `noDescription`, `noteNotFoundConfirm`, `btnCreate`, `invalidTimeFormat`, `dashboardTitle` 등 §11 대시보드 관련 키 포함)이 추가로 필요해 `i18n.ts`에 보강했습니다. 이 표는 mockup 기준 최초 스펙이고, 실제 소스 오브 트루스는 `src/i18n.ts`의 `STRINGS`입니다.

---

## 10. 사이드바 전용 라이트/다크 테마

> 사이드바 색상을 Obsidian 전체 테마와 완전히 분리해서, 플러그인 자체 설정으로 전환할 수 있게 합니다. **"자동(Obsidian 따라가기)" 옵션은 없고 "라이트"/"다크" 둘 중 하나만 고정 선택**합니다.

### 10.1 세 가지 테마 개념 (혼동 주의)

| 대상 | 테마 소스 | 설정 위치 |
|---|---|---|
| 사이드바 (`view.ts`) | 플러그인 자체 설정 (`라이트`/`다크`) | `SettingTab.ts` "사이드바 테마" |
| 모달/팝업 (이벤트/확인) | 시스템 테마 (`Canvas`/`CanvasText`) | 없음 — 항상 시스템을 따름 (원칙 4) |
| 대시보드 (`DashboardView.ts`) | Obsidian 자체 테마 변수 | 없음 — Obsidian 테마를 그대로 따름 (원칙 5) |

### 10.2 색상 토큰

`.dwl-theme-light` / `.dwl-theme-dark` 클래스를 사이드바 뷰 루트(`view.ts`의 `refresh()`에서 토글)에 씌우고, `styles.css`에서 아래 `--dwl-*` 커스텀 프로퍼티를 스코프별로 정의합니다.

| 토큰 | 라이트 (mockup 기준) | 다크 (신규, slate 계열) |
|---|---|---|
| `--dwl-bg` | `#ffffff` | `#1e293b` |
| `--dwl-bg-header` | `#fafafa` | `#0f172a` |
| `--dwl-bg-secondary` | `#f8fafc` | `#0f172a` |
| `--dwl-bg-hover` | `#f1f5f9` | `#334155` |
| `--dwl-bg-active` | `#e2e8f0` | `#475569` |
| `--dwl-border` | `#e2e8f0` | `#334155` |
| `--dwl-border-light` | `#eaeaea` | `#1e293b` |
| `--dwl-text` | `#1e293b` | `#e2e8f0` |
| `--dwl-text-muted` | `#64748b` | `#94a3b8` |
| `--dwl-text-faint` | `#94a3b8` | `#64748b` |
| `--dwl-accent` | `#3b82f6` | `#60a5fa` |
| `--dwl-accent-text` | `#ffffff` | `#ffffff` |

다크 팔레트는 별도로 제공된 다크 mockup이 없어서, 라이트 mockup과 동일한 색상군(Tailwind slate)으로 새로 만든 대응 팔레트입니다. 나중에 실제 다크 mockup이 생기면 이 표를 갱신하세요.

### 10.3 설정 UI

`SettingTab.ts`에 "사이드바 테마" 드롭다운 (`라이트`/`다크`), 기본값 `라이트`. 변경 시 `refreshViews()`로 즉시 사이드바에 반영.

---

## 11. 대시보드(Dashboard) 뷰

> 볼트 내 전체 데일리 노트를 스캔·요약하는 화면. **사이드바가 아니라 메인 워크스페이스의 일반 탭**으로 엽니다 (`activateDashboard()` → `workspace.getLeaf("tab")`).

### 11.1 통계 항목

| 통계 | 계산 범위 | 비고 |
|---|---|---|
| 총 노트 수 | 전체 볼트 | 파일명(날짜)만 스캔, 내용 읽지 않음 |
| 기록 기간 (가장 오래된 ~ 최근) | 전체 볼트 | 위와 동일 |
| 연속 작성일(스트릭) | 전체 볼트 | 오늘부터 거꾸로, 끊기는 지점까지. 오늘 노트가 없으면 0 |
| 최근 30일 To-Do 완료율 | 최근 30일 | **이 통계만** 실제 파일 내용을 읽음 (`app.vault.cachedRead`) |
| 최근 30일 총 이벤트 기록 시간 | 최근 30일 | 위와 동일, `timelineDurationMinutes` 재사용 (자정 넘는 이벤트 처리 동일) |

**성능 고려**: 파일 내용을 읽어야 하는 통계는 최근 30일로 범위를 제한합니다(`dashboardCollector.ts`의 `getRecentWindowStart`). 볼트에 몇 년 치 노트가 쌓여 있어도, 대시보드를 열 때마다 전체를 다시 읽지 않습니다.

### 11.2 레이아웃

```
┌─────────────────────────────────────────┐
│ 대시보드                        [새로고침] │
├─────────────────────────────────────────┤
│ [총 노트 수]  [연속 작성일]  [기록 기간]   │
│ [최근 30일 완료율]  [최근 30일 기록 시간]  │
├─────────────────────────────────────────┤
│ 최근 노트                                │
│  2026-07-14                              │
│  2026-07-13                              │
│  ...                                     │
└─────────────────────────────────────────┘
```

- 통계 카드: `dwl-dashboard-stat-card` (라벨 + 값)
- 최근 노트 목록 항목 클릭 → `workspace.openLinkText(file.path, "", false)`로 해당 노트 열기
- 데일리 노트가 하나도 없으면 빈 상태 문구(`dashboardEmptyVault`)만 표시

### 11.3 테마

원칙 5(§, 상단)대로 Obsidian 자체 테마 변수만 사용. 사이드바의 `--dwl-*` 토큰이나 별도 설정은 적용하지 않습니다.
