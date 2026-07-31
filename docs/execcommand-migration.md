# `execCommand` 탈피 설계 문서

> 상태: 제안(Draft) · 대상: `sagak-core` · 관련: `packages/react/ROADMAP.md` Phase 8,
> [`reference-codemirror-state.md`](./reference-codemirror-state.md) (functional core 원칙·델타 인코딩)

## 1. 배경과 목적

현재 sagak의 서식 적용은 `document.execCommand`에 전면 의존합니다. `execCommand`는
[MDN에서 deprecated](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand)로
표시되어 있으며 다음 문제가 있습니다.

- **명세 없음/브라우저별 상이**: 같은 명령이 브라우저마다 다른 마크업을 생성합니다
  (예: `bold` → `<b>` vs `<strong>` vs `<span style>`). 결과 HTML을 예측·정규화하기 어렵습니다.
- **제어 불가**: 태그/속성/중첩 방식을 지정할 수 없어 콘텐츠 모델을 강제할 수 없습니다.
- **미래 위험**: 브라우저가 언제든 제거/변경할 수 있으며 신규 기능 지원이 없습니다.
- **테스트 취약성**: 브라우저 내부 동작에 의존해 회귀를 잡기 어렵습니다.

**목적**: `execCommand`/`queryCommandState` 의존을 제거하고, 예측 가능하고 테스트 가능한
자체 서식 엔진으로 점진적으로 전환합니다. 이 문서는 그 중간 단계를 정의합니다.
ROADMAP Phase 8(블록 기반 에디터)의 **선행 작업**입니다 — 여기서 만드는 커맨드 추상화가
블록 모델로 가는 다리 역할을 합니다.

## 2. 현재 사용 실태 (인벤토리)

`execCommand` 호출은 코어 21개 파일에 분포합니다. 명령을 성격별로 분류하면:

| 분류 | 명령 | 사용처(플러그인) | 대체 난이도 |
| --- | --- | --- | --- |
| 인라인 토글 | `bold` `italic` `underline` `strikeThrough` `subscript` `superscript` | bold/italic/... | 중 |
| 인라인 스타일 | `foreColor` `backColor` `fontName` `fontSize` | text-color/background-color/font-family/font-size | 중 |
| 블록 포맷 | `formatBlock`(`<h1~6>`, `<p>`) | heading/paragraph | 중 |
| 리스트 | `insertOrderedList` `insertUnorderedList` | ordered-list/unordered-list | 상 |
| 들여쓰기 | `indent` `outdent` | indent/outdent | 상 |
| 정렬 | `justifyLeft/Center/Right/Full` | alignment | 하 |
| 링크 | `createLink` `unlink` | link | 중 |
| 삽입 | `insertHTML` `insertText` | selection-manager(주경로), wysiwyg-area(폴백) | 하 |

**상태 조회**: `editor-core.ts`의 서식 상태 추적이
`queryCommandState('bold'|'italic'|'underline'|'strikeThrough'|'subscript'|'superscript')`를 사용합니다.

### 이미 execCommand와 무관한 부분 (재확인)

- **Undo/Redo**: `HistoryManager`가 `innerHTML` 스냅샷을 저장/복원합니다. `execCommand('undo')`를
  쓰지 않으므로 **이번 마이그레이션 범위 밖**입니다. (오히려 커맨드가 DOM을 직접 조작하도록 바뀌면
  스냅샷 타이밍만 유지하면 됩니다.)
- **삽입 기본 경로**: `SelectionManager.insertHTML/insertText`는 이미 `Range` API
  (`createContextualFragment`, `insertNode`)로 구현되어 있습니다. `wysiwyg-area`의
  `execCommand('insertHTML')`는 SelectionManager가 없을 때의 폴백일 뿐입니다.

즉, 인프라의 상당 부분(선택/범위, 히스토리)은 이미 자체 구현이라 전환 표면은 **서식 명령 자체**에 집중됩니다.

## 3. 목표 아키텍처

### 3.1 핵심 아이디어 — 커맨드 추상화 레이어

플러그인이 `document.execCommand`를 **직접 호출하지 않고** 코어가 제공하는 `CommandRegistry`를
통하도록 만듭니다. 각 커맨드는 인터페이스 뒤에서 구현을 교체할 수 있습니다.

```typescript
interface EditorCommand {
  /** 커맨드 이름 (예: 'bold', 'foreColor') */
  name: string
  /** 현재 선택 영역에 커맨드를 실행. 성공 시 true */
  execute(ctx: CommandContext, value?: string): boolean
  /** (선택) 현재 선택 영역에서 활성 상태인지 조회 */
  queryState?(ctx: CommandContext): boolean
  /** (선택) 현재 값 조회 (예: 폰트 크기) */
  queryValue?(ctx: CommandContext): string | null
}

interface CommandContext {
  selectionManager: SelectionManager
  element: HTMLElement
  eventBus: EventBus
}
```

플러그인 핸들러 컨텍스트에 `runCommand(name, value?)`를 추가하여, 플러그인 코드는
구현 방식을 몰라도 되게 합니다.

```typescript
// Before
on: ({ emit }) => {
  emit(CoreEvents.CAPTURE_SNAPSHOT)
  return document.execCommand('bold', false)
}

// After
on: ({ runCommand }) => runCommand('bold')
// runCommand 내부: CAPTURE_SNAPSHOT 발행 → 커맨드 실행 → STYLE_CHANGED 발행
```

### 3.2 이 설계의 이점

- **점진적 전환**: 1단계에서 모든 커맨드를 `execCommand`로 **그대로 위임**하는 어댑터로 구현하면
  동작·테스트가 불변입니다. 이후 커맨드를 **하나씩** 자체 구현으로 교체합니다.
- **경계 격리**: `execCommand`가 `CommandRegistry` 내부에만 존재하게 되어, 남은 의존을 한눈에
  추적하고 제거할 수 있습니다.
- **테스트 용이**: 각 커맨드가 `(입력 HTML + 선택) → 출력 HTML`의 순수 단위로 테스트됩니다.
- **콘텐츠 모델 강제**: 자체 구현은 `<strong>`/`<em>` 등 원하는 태그만 생성하도록 보장합니다.

### 3.3 커맨드 핸들러 precedence (Wordgard 차용)

> 참고: [`docs/comparison-wordgard.md`](./comparison-wordgard.md) — Wordgard의 `Command` 개념.

단일 구현으로 고정하지 말고, 하나의 커맨드에 **여러 핸들러를 precedence 순으로** 등록할 수 있게
설계합니다. 핸들러는 처리하면 결과를 반환하고, 처리하지 않으면 `false`/`undefined`를 반환해 다음
핸들러로 넘깁니다.

```typescript
type CommandHandler = (ctx: CommandContext, value?: string) => boolean | undefined

interface CommandRegistry {
  /** 커맨드에 핸들러를 등록 (높은 precedence가 먼저 시도됨) */
  register(name: string, handler: CommandHandler, prec?: number): () => void
  /** precedence 순으로 핸들러를 시도, 처리한 핸들러가 있으면 true */
  run(name: string, value?: string): boolean
  queryState(name: string): boolean
}
```

이점:
- **오버라이드 가능**: 소비자/플러그인이 특정 상황(예: 표 안의 Enter)에서만 기본 동작을 가로챌 수 있음.
- **위임 어댑터와 자연스럽게 공존**: `LegacyExecCommand`를 최저 precedence로 두고, 자체 구현을 더 높은
  precedence로 얹으면 **커맨드 단위 점진 교체**가 그대로 precedence 등록/해제로 표현됨.
- 기존 `EventBus`의 `before/on/after`와 상보적: precedence는 "누가 먼저 처리하고 멈출지"를 다룸.

## 4. 커맨드별 대체 전략

### 4.1 정렬 (가장 쉬움 — 파일럿 후보)
`justify*`는 블록 요소의 `text-align` 스타일로 대체합니다. 현재 선택이 걸친 블록을 찾아
`style.textAlign`을 설정. 상태 조회는 `getComputedStyle(block).textAlign`.

### 4.2 인라인 토글 (bold/italic/underline/strike/sub/sup)
선택 범위를 감싸는 래퍼 태그(`<strong>`/`<em>`/`<u>`/`<s>`/`<sub>`/`<sup>`)를 적용/해제합니다.
- **적용**: `range.surroundContents` 또는 범위를 순회하며 텍스트 노드를 래핑.
- **해제(토글 off)**: 선택 영역이 이미 해당 서식이면 래퍼를 제거(unwrap)하고 경계에서 분할.
- **상태 조회**: 선택 anchor에서 조상 방향으로 해당 태그 존재 여부 탐색 → `queryCommandState` 대체.
- 경계 분할·부분 선택·중첩 처리가 핵심 난점. 이 로직은 공용 `inline-format.ts` 유틸로 추출.

#### 정규형 마크 정렬 (Wordgard 차용)

> 참고: [`docs/comparison-wordgard.md`](./comparison-wordgard.md) — Wordgard의 flat·ordered marks.

HTML은 인라인 래퍼의 중첩 순서가 자유로워(`<strong><em>` vs `<em><strong>`) 같은 의미의 콘텐츠가
여러 마크업으로 표현됩니다. 이는 diff·비교·테스트·살균을 어렵게 만드는 근본 원인입니다.

자체 인라인 엔진에서는 각 마크에 **rank를 부여**하고, 겹치는 마크의 래퍼를 **항상 rank 순으로 중첩**하도록
정규화합니다. 예: `strong`(60) > `em`(50) > `underline`(40) …이면 항상 `<strong><em><u>…` 순.
- 결과: 동일 의미 콘텐츠 = **단일 정규 표현(canonical form)**. 스냅샷 테스트가 안정적이고, 인접 동일-마크
  텍스트 병합/언랩이 결정론적이 됨.
- 이 정렬 규칙을 `inline-format.ts`에 rank 테이블로 두고, 적용·해제·병합 모든 경로가 이를 따르게 함.
- 살균 계층(`sanitizer.ts`)과도 정합: 붙여넣기 HTML을 파싱 후 동일 rank 정렬로 정규화하면 외부 마크업의
  편차를 흡수.

### 4.3 인라인 스타일 (foreColor/backColor/fontName/fontSize)
`<span style="...">`로 래핑합니다. `fontSize`는 현재 `execCommand`의 레거시 1–7 스케일을 쓰는데,
자체 구현에서는 `px`/`rem` 등 실제 CSS 값으로 전환(값 매핑 테이블 제공, 하위호환 옵션 고려).

### 4.4 블록 포맷 (heading/paragraph)
선택이 걸친 블록 요소를 목표 태그(`h1~h6`/`p`)로 **치환**합니다. 자식/인라인 서식은 보존.
`formatBlock`의 브라우저별 편차(대소문자, `<H1>` vs `h1`)를 제거.

### 4.5 링크 (createLink/unlink)
`createLink`는 선택 범위를 `<a href>`로 래핑(4.2의 인라인 래핑 재사용). `unlink`는 `<a>` unwrap.
URL은 **정화 계층**(이미 도입된 sanitizer)과 연동하여 `javascript:` 차단.

### 4.6 리스트 / 들여쓰기 (가장 어려움 — 마지막)
`insertOrderedList`/`insertUnorderedList`/`indent`/`outdent`는 블록 구조 변형이라 가장 복잡합니다
(문단↔리스트 전환, 중첩 리스트, 리스트 항목 병합/분할). 자체 구현은 상당한 트리 조작을 요구하므로
**최후 순위**로 두고, 필요 시 이 영역만 별도 라이브러리 검토.

## 5. 상태 조회(queryCommandState) 대체

`editor-core`의 서식 상태 추적을 `CommandRegistry`의 `queryState`로 대체합니다.
현재 `queryCommandState`를 rAF 디바운스로 호출하는 구조(`setupFormattingStateTracking`)는 유지하고,
호출 대상만 `commands.queryState(name)`로 바꿉니다. 초기에는 `queryState`가 `queryCommandState`를
위임하므로 동작 불변, 이후 4.2의 조상 탐색 기반으로 교체.

> **연계**: `queryState`가 반환하는 파생 값은 signal(`computed`)로 노출하기에 가장 자연스러운 대상입니다.
> 파생 상태 계층을 signal로 구성하는 방안은 [`signals-adoption.md`](./signals-adoption.md) 참고.

## 6. 단계별 로드맵

각 단계 종료 시 **전체 테스트 통과 + Storybook 육안 확인**을 게이트로 둡니다.

- **P0 — 커맨드 추상화 골격**
  - `CommandRegistry`(precedence 핸들러, §3.3), `EditorCommand`, `CommandContext` 정의
  - 모든 명령을 `execCommand`에 위임하는 `LegacyExecCommand` 어댑터를 **최저 precedence**로 등록
  - 핸들러 컨텍스트에 `runCommand`/`queryState` 추가, 플러그인을 `runCommand`로 이행
  - `queryCommandState` 추적을 `commands.queryState`로 이행
  - **동작·마크업 불변**(순수 리팩터). 회귀 안전망 확보.

- **P1 — 저난이도 자체 구현**: 정렬(4.1) → 블록 포맷(4.4). 각 커맨드를 `LegacyExecCommand`보다 높은
  precedence로 얹어 교체. 각 커맨드 단위 테스트 추가.

- **P2 — 인라인 서식 엔진**: `inline-format.ts`(래핑/언랩/경계 분할/상태 조회 + **정규형 마크 rank 정렬**,
  §4.2) 구현 후 토글 6종 + 스타일 4종(4.2/4.3) + 링크(4.5)를 교체. 이 단계가 가장 많은 테스트를 요구.

- **P3 — 리스트/들여쓰기**(4.6): 트리 조작 구현 또는 범위 축소 결정.

- **P4 — 정리**: `CommandRegistry` 밖의 `execCommand`/`queryCommand*` 잔존 제거,
  `insertHTML`/`insertText` 폴백을 Range 경로로 일원화, `fontSize`·상태/값 조회 자체 구현.
  `LegacyExecCommand` 어댑터 제거는 아래 §6.1의 선행 조건이 해결된 뒤에 가능합니다.

### 6.1 어댑터 제거의 선행 조건 — 보류 중인 서식 상태(stored marks)

P4까지 진행하면 레거시 어댑터가 실제로 처리하는 경우는 **collapsed 커서에서의 토글/스타일**
하나로 좁혀집니다. 이 경로만 남는 이유는 `execCommand`가 브라우저 내부에 "다음 입력에 적용할
서식" 상태를 들고 있기 때문입니다 — 커서만 둔 채 굵게를 켜고 타이핑하면 굵게로 입력되는 동작.

자체 구현으로 대체하려면 그 상태를 에디터가 직접 소유해야 합니다.

- **보류 서식 상태**: 현재 커서 위치와 그때 토글된 서식 집합을 상태로 보관
  (ProseMirror의 stored marks, CM6의 상태 필드에 해당)
- **입력 시 적용**: `beforeinput`/`input`을 가로채 삽입되는 텍스트에 보류 서식을 적용
- **무효화**: 선택이 이동하거나 문서가 바뀌면 보류 상태를 폐기
- **상태 조회 반영**: `queryState`가 보류 서식도 활성으로 보고해야 툴바 표시가 일치

이는 단순 커맨드 교체가 아니라 **에디터 상태 모델의 확장**이므로 별도 단계로 다룹니다.
이 상태가 도입되면 어댑터와 `WysiwygArea.execCommand` 탈출구를 함께 제거할 수 있습니다.

## 7. 리스크와 완화

| 리스크 | 완화 |
| --- | --- |
| IME/CJK 조합 중 DOM 조작 시 조합 깨짐 | 기존 `SelectionManager.getIsComposing()` 가드 재사용, 조합 종료 후 적용 |
| 선택 범위 경계·부분/중첩 선택 처리 버그 | `inline-format` 유틸에 로직 집중 + 광범위한 `(HTML,선택)→HTML` 단위 테스트 |
| 자체 구현 마크업이 기존과 달라 콘텐츠 회귀 | P0에서 스냅샷 테스트로 기준 고정, 커맨드 교체 시 diff 검토 |
| Undo/Redo 스냅샷 타이밍 | 커맨드 실행 전 `CAPTURE_SNAPSHOT` 발행 규약을 `runCommand`에 내장 |
| 범위 확대에 따른 일정 | 단계별 독립 배포 가능 구조(P1만으로도 가치). 리스트(P3)는 분리 가능 |

## 8. 테스트 전략

- **골든/스냅샷**: 각 커맨드에 대해 입력 HTML + 선택 시나리오 → 출력 HTML 스냅샷.
- **상태 조회**: 커서를 서식 내부/경계/외부에 두고 `queryState` 정확도 검증.
- **브라우저 실측**: 기존 vitest browser(Chromium) 유지. `SelectionManager` 실제 Selection/Range 사용.
- **회귀 게이트**: P0 도입 시 전체 스위트가 불변 통과해야 함(위임 어댑터이므로).

## 9. 범위 밖 (명시)

- 블록 기반 렌더링(ROADMAP Phase 8) 자체 — 본 문서는 contentEditable을 유지한 채 서식 엔진만 교체.
- 협업 편집(CRDT/OT), 실시간 동기화.
- Undo/Redo 재설계(현행 스냅샷 유지). 델타 기반 undo 대안은 [`reference-codemirror-state.md`](./reference-codemirror-state.md) §2 참고.

---

*이 문서는 제안 단계입니다. P0(커맨드 추상화 골격)만으로도 `execCommand` 의존을 단일 경계로 격리하는
독립적 가치가 있으므로, 우선 P0 착수를 권장합니다.*
