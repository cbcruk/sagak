# EventBus 정리 설계 노트 — core 한정

> 상태: 제안(Draft) · 대상: `sagak-core`
> 관련: [`preact-migration.md`](./preact-migration.md) §3, [`signals-adoption.md`](./signals-adoption.md), [`reference-codemirror-state.md`](./reference-codemirror-state.md)

## 요약 (결론 먼저)

1. **3단계(`before`/`on`/`after`) 생명주기는 실제로 거의 비어 있습니다.** `after` 40개 중 35개가
   빈 함수이고, `before` 35개는 **전부 동일한 IME composition 가드로 시작**합니다(그중 9개만
   가드 뒤에 고유한 페이로드 검증을 덧붙입니다).
2. **주요 에디터 5종을 소스로 확인한 결과, 단계 모델을 쓰는 곳이 하나도 없습니다.** 버스를
   유지한 두 곳(Quill, Editor.js)조차 단계는 없습니다.
3. **레퍼런스가 IME를 덜 다루는 게 아닙니다.** 오히려 더 많이 다루되, 가드를 **디스패치 경계
   한 곳**에 둡니다. sagak은 그 자리를 못 찾아 커맨드마다 복사했습니다.
4. 따라서 순서는 "버스를 교체하자"가 아니라 **"가드를 제자리에 놓으면 단계가 남을 이유를
   잃는다"**입니다. 그 뒤에야 교체가 기계적인 작업이 됩니다.

---

## 1. 측정 — 3단계 모델의 실제 사용

`packages/core/src` 기준입니다.

### `after` — 40개 중 35개가 빈 함수

| 위치 | 개수 | 내용 |
| --- | --- | --- |
| `definePlugin`의 `after:` | 21 | **전부 `after: () => {}`** |
| 수동 `eventBus.on(…, 'after', …)` | 19 | 그중 14개가 `() => {}` |
| **실제 동작하는 것** | **5** | `editor-core.ts:608/613/618`(서식 상태 추적), `auto-save-plugin.ts:187/196`(`scheduleSave`) |

살아있는 5개가 하는 일은 전부 **"작업이 끝난 뒤 실행"**이라는 순서뿐입니다. 단일 단계에서 작업
후에 알림을 발행해도 동일합니다.

### `before` — 35개 전부 동일한 IME 가드로 시작

| 위치 | 개수 |
| --- | --- |
| `definePlugin`의 `before:` | 21 |
| 수동 `eventBus.on(…, 'before', …)` | 14 (image 3, table 6, link 2, find-replace 3) |

**모두** 이 형태로 시작합니다.

```ts
if (opts.checkComposition && selectionManager?.getIsComposing()) {
  logger.warn('<플러그인명> blocked: IME composition in progress')
  return false
}
```

로그 문구만 다릅니다. `checkComposition`을 `false`로 두는 플러그인은 **하나도 없습니다.**

가드 뒤에 고유 로직이 붙는 경우도 있습니다. `definePlugin` 21개 중:

- **12개는 IME 가드만** — bold, italic, underline, strike, subscript, superscript,
  indent, outdent, paragraph, horizontal-rule, ordered-list, unordered-list
- **9개는 페이로드 검증도** — alignment, background-color, font-family, font-size, heading,
  letter-spacing, line-height, special-character, text-color

즉 가드를 걷어내면 12개는 `before`가 통째로 사라지고, 9개는 검증만 남습니다. 어느 쪽이든
**IME 가드가 단계를 요구하는 유일한 이유**라는 점은 그대로입니다.

### 취소 결과를 보는 곳은 1군데

`emit`의 반환값을 소비하는 곳은 `editor-core.ts:300`의 `exec()`뿐이고, 그마저 호출자에게 그대로
넘길 뿐입니다.

### 손익

3단계가 **치르는 비용**은 빈 핸들러 35개 + 그 구독 해제 부기 + 중복된 IME 가드 35개이고,
**사주는 것**은 횡단 관심사 하나(IME)와 순서 보장입니다.

---

## 2. 레퍼런스 조사 — 주요 에디터 5종

전부 저장소를 clone해 소스에서 직접 확인했습니다 (기억이 아니라 코드 기준).

| 에디터 | 이벤트 버스 | 명령 디스패치 | 상태 알림 | 취소 |
| --- | --- | --- | --- | --- |
| **Lexical** | **없음** | `registerCommand(cmd, fn, priority)` — 우선순위 큐 5단계 | 이름 붙은 슬롯 5종 (`update`/`editable`/`decorator`/`textcontent`/`mutation`) | 리스너가 `true` 반환 → 전파 중단 |
| **ProseMirror** | **없음** | `someProp(name, f)` — 플러그인 순회, 첫 truthy가 이김 | `dispatchTransaction` | 반환값 |
| **CodeMirror 6** | **없음** | facet + state effect | `updateListener` facet | precedence |
| **Editor.js** | 있음 — `EventsDispatcher<EventMap>` | 없음(버스가 겸함) | 동일 버스 | **없음** |
| **Quill** | 있음 — `eventemitter3` | 없음 | 동일 버스 | 없음 |

### 성숙한 에디터일수록 버스를 쓰지 않는다

Lexical·ProseMirror·CodeMirror 셋 다 소스에 `EventEmitter`/`eventBus` 문자열이 **아예 없습니다.**
대신 **이름 붙은 확장점**을 씁니다.

Lexical의 `_listeners`는 문자열 키 맵이 아니라 슬롯이 고정된 구조체입니다. 슬롯이 고정이면 각
슬롯의 **페이로드 타입이 정해집니다** — 지금 sagak이 런타임 타입가드 15개를 손으로 쓰는 이유가
정확히 이 지점입니다.

### 명령은 전부 "우선순위 + 첫 처리자 승리"

Lexical의 디스패치 루프 (`LexicalUpdates.ts` `triggerCommandListeners`):

```js
for (let i = 4; i >= 0; i--) {            // 우선순위 높은 큐부터
  ...
  for (const listener of listenersSet) {
    if (listener(payload, fromEditor)) { returnVal = true; return }   // 처리했으면 중단
  }
  if (returnVal) return returnVal
}
```

ProseMirror의 `someProp`도 같은 모양입니다 — 플러그인을 순회하다 truthy를 만나면 멈춥니다.

**어느 쪽도 before/on/after 같은 단계를 두지 않습니다.** 순서는 우선순위 숫자로 표현합니다.

> sagak의 `CommandRegistry`가 이미 이 구조입니다 — precedence 정렬 + `undefined`면 다음으로 위임.
> 즉 **업계 표준 구조를 이미 갖고 있고, 그 위에 3단계 버스가 하나 더 얹혀 있는 상태**입니다.

### 버스를 남긴 두 곳도 단계는 없다

Editor.js의 `EventsDispatcher<EventMap>`는 `on`/`emit`/`off`뿐입니다. 대신 **이벤트 하나당 파일
하나**로 이름 상수와 페이로드 타입을 함께 두고 결합합니다.

```ts
export interface EditorEventMap {
  [BlockChanged]: BlockChangedPayload
  [BlockHovered]: BlockHoveredPayload
  …
}
```

Quill도 `eventemitter3` 위에 상수 목록만 얹었습니다.

---

## 3. IME 가드는 어느 계층에 있어야 하는가

### 레퍼런스는 IME를 피하지 않았다

Lexical의 `isComposing()` 검사 19곳 분포:

| 파일 | 개수 | 성격 |
| --- | --- | --- |
| `LexicalEvents.ts` | 12 | DOM 이벤트 핸들러 |
| `LexicalUtils.ts` | 3 | 노드 유틸 |
| `LexicalSelection.ts` | 2 | 선택 영역 |
| `LexicalEditor.ts` / `LexicalGC.ts` | 각 1 | 플래그 정의 / 정리 |
| **커맨드 디스패치 경로** | **0** | — |

ProseMirror도 `composing` 참조 23곳 중 14곳이 `input.ts`, 나머지도 `domchange.ts`/`domobserver.ts`로
**전부 DOM 계층**입니다. Lexical에는 Android Chrome 전용 composition 우회까지 있습니다.

핵심은 이 형태입니다 (`LexicalEvents.ts:1567`).

```js
if (editor.isComposing()) {
  return
}
dispatchCommand(editor, KEY_DOWN_COMMAND, event)
```

**가드가 커맨드마다 있는 게 아니라, DOM 이벤트 → 커맨드 경계에 딱 하나 있습니다.**

### sagak이 흩어진 경로

`selection-manager.ts`는 이미 `compositionstart`/`compositionend`로 플래그를 관리하고 자기 안에서
10곳을 가드합니다(`insertHTML`, `insertText`, `delete` 등). 여기까지는 Lexical과 같은 구조입니다.

문제는 그 위입니다. `getIsComposing()` 호출 **39회 / 29개 파일** 중 **35회가 `plugins/`**,
core+editor는 4회뿐입니다.

이것이 3단계 모델의 존재 이유로 보입니다 — **`before` 단계의 유일한 용도가 IME 가드입니다.**
가드를 놓을 자리가 필요해서 단계를 만들었고, 단계를 만들었으니 `after`도 짝으로 생겼는데,
`after`는 쓸 일이 없어 40개 중 35개가 빈 함수로 남았습니다.

### sagak의 사정은 하나 다르다 — 그래도 경계는 하나다

Lexical·ProseMirror의 커맨드는 대부분 **DOM 이벤트에서 발원**합니다(keydown, paste, beforeinput).
그래서 DOM 경계 가드 하나면 덮입니다.

sagak의 커맨드는 **툴바 버튼 클릭에서 발원**합니다 — `eventBus.emit(BOLD_CLICKED)`. core 안에
가드할 DOM 경계가 없습니다. **그래서 각 플러그인에 붙인 것 자체는 이해할 수 있는 선택이었습니다.**

하지만 sagak에도 경계는 하나 있습니다: **`define-plugin.ts`의 `createHandlerContext`** — 모든
플러그인 핸들러가 여기를 통과합니다. Lexical의 `dispatchCommand` 진입점에 대응합니다.

---

## 4. 계획

### A단계 — 가드를 제자리로 (비파괴적, 공개 API 불변) — **완료 (§8)**

1. IME 가드를 `define-plugin.ts`의 핸들러 래퍼로 이관
   - `definePlugin` 플러그인 21개의 `before` 가드가 한 번에 사라짐
   - 플러그인별 `checkComposition` 옵션은 래퍼가 읽으므로 **API가 안 깨짐**
   - 수동 구독 4개(image·table·link·find-replace, 14곳)는 `definePlugin`으로 옮기거나 개별 처리
2. 빈 `after` 35개 삭제

이것만으로 core에서 EventBus가 하는 일이 **"발행 → 등록 순서로 리스너 실행"**만 남습니다.
그게 정확히 `EventTarget`의 의미론입니다.

### B단계 — 핸들러를 단일 함수로 — **완료 (§9)**

`definePlugin`의 `{ before, on, after }` → 단일 함수. before/after가 이미 사라진 뒤라 자연스럽고,
테스트의 `'on'` 참조 148회도 이 시점에 한 번에 정리됩니다.

### C단계 — 버스 처리

여기서 갈래가 둘입니다.

| 노선 | 내용 | 성격 |
| --- | --- | --- |
| **Lexical/ProseMirror** | 버스 제거. 이름 붙은 슬롯 + `CommandRegistry`로 통합 | 타입이 자연히 붙음. 변경 폭 큼 |
| **Editor.js** | 버스 유지 + `EventMap`으로 타입 부여 | 변경 폭 작음. 문자열 키 유지 |

`CommandRegistry`가 이미 Lexical의 우선순위 큐와 같은 일을 하므로 전자가 자연스러운 종착지로
보입니다. **호스트 앱 확장점(역할 ④)은 Lexical도 `registerCommand`/`registerUpdateListener`로
공개하므로, 버스가 사라져도 확장성이 줄지 않습니다.**

이 선택은 A·B를 끝낸 뒤에 해도 늦지 않습니다. A·B가 어느 쪽이든 필요한 정리이기 때문입니다.

---

## 5. 테스트 비용 (실측)

| 항목 | 수치 |
| --- | --- |
| `'before'` 참조 | 18회 / 7파일 |
| `'after'` 참조 | 35회 / 8파일 |
| `'on'` 참조 | 148회 / 30파일 |
| "3단계 실행 흐름" 류 테스트 블록 | 41개 |
| `event-bus` 자체 테스트 | 45개 |
| IME/composition 관련 테스트 파일 | 22개 |

A단계에서 깨지는 건 주로 `'after'` 35회와 "차단 시 BEFORE 단계에서 중단해야 함" 4개입니다.
`'on'` 148회는 A단계를 그대로 통과하고 B단계에서 정리됩니다.

---

## 6. 아직 확인하지 않은 것

레거시 어댑터를 검토할 때는 실제로 제거해보고 **188개 실패**를 실측한 뒤 판단했습니다
([`execcommand-migration.md`](./execcommand-migration.md) §6.2). 같은 규율을 적용하면 남은 것이
있습니다.

- ~~A단계의 테스트 파급~~ → 측정 완료: **테스트 수정 0건** (§8)
- ~~IME 가드를 래퍼로 올렸을 때의 동작 동일성~~ → 확인 완료 (§8)
- ~~B단계의 테스트 파급~~ → 측정 완료: **테스트 1개 파일만 수정** (§9)
- **C단계 노선 선택.** A·B가 끝났으므로 지금 판단 가능합니다 (§9 말미).

## 7. 곁가지로 발견한 것

`selection-manager.ts:491`에 이런 주석이 있습니다.

```
// 참조를 저장하지 않아 composition 리스너를 제거할 수 없음
```

`compositionstart`/`compositionend` 리스너가 정리되지 않는 기존 문제입니다. 이 작업과 직접
관계는 없지만 IME 경로를 손대는 김에 같이 볼 만합니다.

## 범위 밖

- `packages/react`(뷰) 쪽 버스 사용 — 뷰 계층 결정과 얽혀 있음
  ([`preact-migration.md`](./preact-migration.md) 참고)
- signals 도입 — [`signals-adoption.md`](./signals-adoption.md)

---

## 8. A단계 실행 기록

### 구현

**`core/composition-guard.ts` (신규)** — `isBlockedByComposition(selectionManager, checkComposition, label)`
하나로 IME 검사 로직을 모았습니다.

**`define-plugin.ts`** — `PluginDefinition`에 `compositionLabel?: string`을 추가하고, 핸들러를
등록할 때 이벤트마다 가드를 **`before` 단계 맨 앞에 자동 등록**합니다.

```ts
const unsubGuard = eventBus.on(eventName, 'before', () =>
  !isBlockedByComposition(selectionManager, finalOptions.checkComposition, compositionLabel)
)
```

`on` 단계로 옮기지 않고 `before`에 등록한 것이 핵심입니다. 그래야 **실행 시점과 체인 중단
의미가 기존과 완전히 같습니다** — 플러그인 자신의 `before`(페이로드 검증)보다 먼저 돌고,
`false`면 `on`·`after`가 모두 건너뛰어지며 `emit`이 `false`를 반환합니다.

`EventBus`는 단계별 핸들러를 `Set`에 등록 순서대로 보관하므로, 가드를 먼저 등록하면 먼저
실행됩니다.

### 결과

| 항목 | 수치 |
| --- | --- |
| IME 가드 제거 (`definePlugin`) | 21곳 |
| → `before` 통째 삭제 | 12개 |
| → 페이로드 검증만 남음 | 9개 |
| IME 가드 → 공유 헬퍼 (수동 구독 4개 플러그인) | 14곳 |
| 빈 `after` 삭제 | 35개 (`definePlugin` 21 + 수동 14) |
| **코드 변화** | **33 files, +403 / −514** |

수동 구독 4개(image·table·link·find-replace)는 `definePlugin`을 쓰지 않아 자동 등록 대상이
아닙니다. 대신 같은 헬퍼를 호출하도록 바꿔 5줄짜리 중복을 1줄로 줄였습니다. 이들을
`definePlugin`으로 옮기는 것은 `onInit` 구조가 복잡해 B단계 이후로 미룹니다.

### 검증 — 테스트 수정 0건

**1009개 전부 통과, 테스트 파일은 한 줄도 고치지 않았습니다.**

이게 이 작업에서 가장 중요한 지점입니다. 테스트들이 IME 차단 시 로그 문구를 **정확히**
단언합니다.

```ts
expect(consoleWarn).toHaveBeenCalledWith('Bold blocked: IME composition in progress')
```

그래서 `compositionLabel`로 문구를 플러그인별로 보존했습니다. 문구를 일괄 변경했다면 테스트
10여 개를 고쳐야 했을 것이고, 그러면 **"동작이 같다"는 증거가 사라집니다.** 기존 테스트가
그대로 통과한다는 사실 자체가 리팩터링이 동작을 보존했다는 증거입니다.

typecheck 통과 / lint 0 errors(기존 `no-explicit-any` 경고 62건 유지) / build 통과.

### 중간에 드러난 것

작업 중 `before` 핸들러 21개가 "전부 IME 가드뿐"이 아니라 **9개는 페이로드 검증도 한다**는
사실이 드러나 §1을 정정했습니다. 처음 측정에서 핸들러 본문을 130자까지만 보고 판단한 것이
원인입니다. 결론(가드가 단계를 요구하는 유일한 이유)은 바뀌지 않지만, 수치는 정확해야 합니다.

---

## 9. B단계 실행 기록

### 변경

`definePlugin`의 핸들러가 `{ before, on, after }` 객체에서 **단일 함수**가 됐습니다.

```ts
// 이전
handlers: { BOLD_CLICKED: { on: (ctx, data) => { … } } }

// 이후
handlers: { BOLD_CLICKED: (ctx, data) => { … } }
```

`PluginEventHandlers` 타입을 제거하고 공개 export에서도 뺐습니다. **파괴적 변경입니다.**

단계 개념은 `EventBus` 내부에만 남습니다. `definePlugin`은 IME 가드를 `before`에, 플러그인
핸들러를 `on`에 등록합니다 — 즉 **플러그인 API에서만 단계가 사라졌고 실행 의미는 그대로**입니다.

### 검증과 실행을 합치니 중복이 드러났다

`before`에서 검증하고 `on`에서 실행하던 9개 플러그인은 **같은 값을 두 번 추출**하고 있었습니다.

```ts
// 이전 — before 와 on 이 각각 추출
before: (ctx, data) => {
  const align = extractAlignment(data)      // 1회차
  if (!align) { … return false }
  if (!isValidAlignment(align)) { … return false }
  return true
},
on: (ctx, data) => {
  try {
    const align = extractAlignment(data)    // 2회차 — 같은 값
    if (!isValidAlignment(align)) return false   // 이미 위에서 걸렀는데 또
    …
```

합치면서 2회차 추출과 죽은 재검증을 제거했습니다. `font-size`는 두 곳이 **이름만 달랐고**
(`size` vs `fontSize`) 같은 값이었습니다 — 단계가 나뉘어 있어 눈에 띄지 않던 종류의 중복입니다.

### 결과

| 항목 | 수치 |
| --- | --- |
| 단일 함수로 전환 | 21개 플러그인 |
| → 기계적 변환 (`on`만 있던 것) | 12개 |
| → 검증+실행 병합 | 9개 |
| 제거된 중복 추출·죽은 재검증 | 9곳 |
| 플러그인에 남은 `before:`/`after:` 키 | **0개** |
| **코드 변화** | **25 files, +604 / −719** |

### 검증

**1009개 전부 통과. 테스트 파일은 1개만 고쳤습니다** — `errors.browser.test.ts`가 옛
`{ on: … }` 형태로 테스트용 플러그인을 만들던 유일한 곳이었습니다.

노트 §5에서 걱정했던 **`'on'` 참조 148회는 하나도 건드리지 않았습니다.** 그 148회는 대부분
`eventBus.on(EVENT, 'on', handler)` 형태의 **구독**이지 `definePlugin`의 핸들러 키가 아니었기
때문입니다. 정적 참조 횟수를 변경 비용으로 읽으면 과대추정된다는 사례입니다.

typecheck 통과 / lint 0 errors / build 통과.

### C단계 판단 근거가 갖춰졌다

A·B를 마친 지금 core의 EventBus가 실제로 하는 일은 이렇습니다.

- `before` — `definePlugin`이 자동 등록하는 IME 가드 전용
- `on` — 플러그인 핸들러 + 일반 구독
- `after` — 실제 사용 5곳 (서식 상태 추적 3, auto-save 2)

즉 **단계는 이제 "가드 → 작업 → 알림"이라는 고정된 3단 파이프라인 하나**를 표현할 뿐이고,
플러그인 작성자에게는 보이지 않습니다. C단계에서 버스를 어떻게 하든 이 파이프라인만 보존하면
됩니다.

