# 작업 예정 사항 (임시 기록)


- [x] **사이드바 뷰에서 HTML 태그 제거 처리 (HTML 태그 스트리핑)** — 완료 (2026-08-14)
  - 구현: `stripHtml()` 추가([src/parser.ts](src/parser.ts)), 단위 테스트([src/parser.test.ts](src/parser.test.ts)), 사이드바 적용([src/components/TimelineView.tsx](src/components/TimelineView.tsx)), PDF export 적용([src/pdfExport.ts](src/pdfExport.ts)), README 주의사항 추가(README.md / README.ko.md).
  - 아래는 작업 시 참고했던 원본 계획 기록.
  - **배경 및 목적**:
    - 옵시디언 마크다운 노트 본문에는 HTML 태그(예: `<font color="...">`, `<b>`, `<span>`, `<br>` 등)가 작성될 수 있으며, 옵시디언 에디터는 이를 실시간 라이브 렌더링함.
    - 특히 [Editing Toolbar](https://github.com/pkm-er/obsidian-editing-toolbar) 플러그인처럼 서식(폰트 색상, 굵게 등)을 적용할 때 원시 HTML 태그를 노트에 직접 삽입하는 플러그인을 사용하는 경우 이런 태그가 실제로 유입됨.
    - 그러나 플러그인 사이드바 뷰(타임라인 그리드/카드, To-Do 리스트)에서는 HTML 코드가 원문 텍스트 그대로 노출되어 가독성이 떨어짐.
    - 사이드바 UI 렌더링 시점에 HTML 태그를 제거(Strip)하여 순수 텍스트만 깔끔하게 표시되도록 개선.
  - **핵심 원칙 (Data Integrity & Scope)**:
    - **원본 파일 보존 (필수)**: 노트 본문 파일의 HTML 태그 데이터는 절대로 훼손되거나 제거되지 않아야 함. 태그 스트리핑은 **오직 사이드바 UI 렌더링 시점(Display Text)**에만 적용.
    - **수정 모달 유지**: 이벤트/할 일 수정 모달(`TimelineModal` 등)에서 편집할 때는 사용자가 작성했던 원본 HTML 태그가 그대로 입력창에 유지되어야 함.
    - **체크박스 토글 안전성**: 사이드바에서 To-Do 체크 토글 시 노트 파일의 HTML 태그가 있는 항목도 텍스트 변경 없이 상태만 안전하게 변경되어야 함.
  - **구체적인 작업 지시사항**:
    1. **HTML 태그 스트리핑 헬퍼 함수 작성 (`src/parser.ts`)**
       - Pure function 형태로 HTML 태그를 제거하는 유틸리티 함수 구현 (예: `stripHtml(text: string): string`).
       - 정규식(예: `/<[^>]*>/g`) 또는 순수 텍스트 추출 패턴을 활용하여 `<font>`, `<b>`, `<span>`, `<div>` 등의 태그 및 속성을 제거.
       - HTML 엔티티(`&nbsp;`, `&lt;`, `&gt;`, `&amp;` 등)도 필요시 적절히 순수 문자로 변환 처리.
    2. **단위 테스트 추가 (`src/parser.test.ts`)**
       - 단일 HTML 태그, 중첩 태그, 속성이 들어간 태그(`<font color="red">`), 셀프 클로징 태그(`<br/>`) 등 다양한 입력 케이스에 대한 스트리핑 동작 검증 테스트 작성.
    3. **사이드바 UI 적용 (`src/components/TimelineView.tsx`)**
       - 타임라인 카드/그리드의 이벤트 설명(`description`) 렌더링 위치에 `stripHtml()` 적용.
       - To-Do 리스트 항목(`text` / `todoFirstLine`) 렌더링 위치에 `stripHtml()` 적용.
    4. **PDF export 적용 (`src/pdfExport.ts`)**
       - 현재 `escapeHtml()`만 적용되어 있어 `<`, `>` 등을 이스케이프할 뿐 태그 자체는 제거되지 않고 그대로 텍스트로 노출됨(예: `&lt;font color="red"&gt;...`).
       - To-Do 항목(`item.text`, line 111) 렌더링 시 `escapeHtml()` 적용 전에 `stripHtml()`을 먼저 적용해 태그를 제거한 뒤 이스케이프하도록 수정.
       - 이벤트 그리드 블록의 `label`(line 88, 90)은 `item.category`(카테고리 이름)이며 노트 본문 자유 텍스트가 아니므로 대상 아님. PDF export에는 이벤트 `description`이 렌더링되는 곳이 없어 이벤트 쪽은 손댈 부분 없음.
       - `stripHtml()`은 `src/parser.ts`의 헬퍼를 그대로 재사용(중복 구현 금지).
    5. **검증 (Verification)**
       - 노트 본문에 HTML 태그가 포함된 이벤트 및 To-Do 작성 후 사이드바에서 순수 텍스트로 노출되는지 확인.
       - 사이드바에서 To-Do 체크박스 토글 시 원본 마크다운 파일 내 HTML 태그가 그대로 유지되는지 확인.
       - HTML 태그가 포함된 To-Do로 PDF export 실행 후, 출력물에 태그 없이 순수 텍스트만 표시되는지 확인.
  - **알려진 한계 및 후속 작업 (README 반영 예정)**:
    - `stripHtml()`을 단순 정규식(`/<[^>]*>/g`)으로 구현할 경우, 본문에 실제 부등호 비교 텍스트(예: `3 < 5 and 10 > 2`)가 있으면 태그로 오인해 잘못 제거될 수 있음. 코드로 완벽히 방어하기보다, README에 "본문에 `<`, `>` 를 태그가 아닌 부등호로 쓰면 사이드바/내보내기에서 사라질 수 있으니 피해달라"는 주의사항을 추가하는 것으로 대응.
    - 이 항목은 stripHtml 구현 작업이 실제로 진행될 때 README.md / README.ko.md에 함께 반영.
