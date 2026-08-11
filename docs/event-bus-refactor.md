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

| 위치                              | 개수  | 내용                                                                                        |
| --------------------------------- | ----- | ------------------------------------------------------------------------------------------- |
| `definePlugin`의 `after:`         | 21    | **전부 `after: () => {}`**                                                                  |
| 수동 `eventBus.on(…, 'after', …)` | 19    | 그중 14개가 `() => {}`                                                                      |
| **실제 동작하는 것**              | **5** | `editor-core.ts:608/613/618`(서식 상태 추적), `auto-save-plugin.ts:187/196`(`scheduleSave`) |

살아있는 5개가 하는 일은 전부 **"작업이 끝난 뒤 실행"**이라는 순서뿐입니다. 단일 단계에서 작업
후에 알림을 발행해도 동일합니다.

### `before` — 35개 전부 동일한 IME 가드로 시작

| 위치                               | 개수                                          |
| ---------------------------------- | --------------------------------------------- |
| `definePlugin`의 `before:`         | 21                                            |
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

| 에디터           | 이벤트 버스                         | 명령 디스패치                                            | 상태 알림                                                                     | 취소                             |
| ---------------- | ----------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------- |
| **Lexical**      | **없음**                            | `registerCommand(cmd, fn, priority)` — 우선순위 큐 5단계 | 이름 붙은 슬롯 5종 (`update`/`editable`/`decorator`/`textcontent`/`mutation`) | 리스너가 `true` 반환 → 전파 중단 |
| **ProseMirror**  | **없음**                            | `someProp(name, f)` — 플러그인 순회, 첫 truthy가 이김    | `dispatchTransaction`                                                         | 반환값                           |
| **CodeMirror 6** | **없음**                            | facet + state effect                                     | `updateListener` facet                                                        | precedence                       |
| **Editor.js**    | 있음 — `EventsDispatcher<EventMap>` | 없음(버스가 겸함)                                        | 동일 버스                                                                     | **없음**                         |
| **Quill**        | 있음 — `eventemitter3`              | 없음                                                     | 동일 버스                                                                     | 없음                             |

### 성숙한 에디터일수록 버스를 쓰지 않는다

Lexical·ProseMirror·CodeMirror 셋 다 소스에 `EventEmitter`/`eventBus` 문자열이 **아예 없습니다.**
대신 **이름 붙은 확장점**을 씁니다.

Lexical의 `_listeners`는 문자열 키 맵이 아니라 슬롯이 고정된 구조체입니다. 슬롯이 고정이면 각
슬롯의 **페이로드 타입이 정해집니다** — sagak이 페이로드를 런타임에 손으로 검사하는 이유가
정확히 이 지점입니다. (그 개수를 15개로 적었으나 실제로는 6개입니다 — §10 정정)

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

| 파일                                | 개수  | 성격               |
| ----------------------------------- | ----- | ------------------ |
| `LexicalEvents.ts`                  | 12    | DOM 이벤트 핸들러  |
| `LexicalUtils.ts`                   | 3     | 노드 유틸          |
| `LexicalSelection.ts`               | 2     | 선택 영역          |
| `LexicalEditor.ts` / `LexicalGC.ts` | 각 1  | 플래그 정의 / 정리 |
| **커맨드 디스패치 경로**            | **0** | —                  |

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

### C단계 — 버스 처리 — **완료 (§10)**

여기서 갈래가 둘입니다.

| 노선                    | 내용                                                 | 성격                           |
| ----------------------- | ---------------------------------------------------- | ------------------------------ |
| **Lexical/ProseMirror** | 버스 제거. 이름 붙은 슬롯 + `CommandRegistry`로 통합 | 타입이 자연히 붙음. 변경 폭 큼 |
| **Editor.js**           | 버스 유지 + `EventMap`으로 타입 부여                 | 변경 폭 작음. 문자열 키 유지   |

`CommandRegistry`가 이미 Lexical의 우선순위 큐와 같은 일을 하므로 전자가 자연스러운 종착지로
보입니다. **호스트 앱 확장점(역할 ④)은 Lexical도 `registerCommand`/`registerUpdateListener`로
공개하므로, 버스가 사라져도 확장성이 줄지 않습니다.**

이 선택은 A·B를 끝낸 뒤에 해도 늦지 않습니다. A·B가 어느 쪽이든 필요한 정리이기 때문입니다.

---

## 5. 테스트 비용 (실측)

| 항목                             | 수치           |
| -------------------------------- | -------------- |
| `'before'` 참조                  | 18회 / 7파일   |
| `'after'` 참조                   | 35회 / 8파일   |
| `'on'` 참조                      | 148회 / 30파일 |
| "3단계 실행 흐름" 류 테스트 블록 | 41개           |
| `event-bus` 자체 테스트          | 45개           |
| IME/composition 관련 테스트 파일 | 22개           |

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
- ~~C단계 노선 선택~~ → Editor.js 노선으로 결정·완료 (§10)
- **버스 제거(Lexical 노선).** 뷰 계층 결정(#9)이 정리된 뒤 재평가.

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
const unsubGuard = eventBus.on(
  eventName,
  'before',
  () =>
    !isBlockedByComposition(
      selectionManager,
      finalOptions.checkComposition,
      compositionLabel
    )
)
```

`on` 단계로 옮기지 않고 `before`에 등록한 것이 핵심입니다. 그래야 **실행 시점과 체인 중단
의미가 기존과 완전히 같습니다** — 플러그인 자신의 `before`(페이로드 검증)보다 먼저 돌고,
`false`면 `on`·`after`가 모두 건너뛰어지며 `emit`이 `false`를 반환합니다.

`EventBus`는 단계별 핸들러를 `Set`에 등록 순서대로 보관하므로, 가드를 먼저 등록하면 먼저
실행됩니다.

### 결과

| 항목                                          | 수치                               |
| --------------------------------------------- | ---------------------------------- |
| IME 가드 제거 (`definePlugin`)                | 21곳                               |
| → `before` 통째 삭제                          | 12개                               |
| → 페이로드 검증만 남음                        | 9개                                |
| IME 가드 → 공유 헬퍼 (수동 구독 4개 플러그인) | 14곳                               |
| 빈 `after` 삭제                               | 35개 (`definePlugin` 21 + 수동 14) |
| **코드 변화**                                 | **33 files, +403 / −514**          |

수동 구독 4개(image·table·link·find-replace)는 `definePlugin`을 쓰지 않아 자동 등록 대상이
아닙니다. 대신 같은 헬퍼를 호출하도록 바꿔 5줄짜리 중복을 1줄로 줄였습니다. 이들을
`definePlugin`으로 옮기는 것은 `onInit` 구조가 복잡해 B단계 이후로 미룹니다.

### 검증 — 테스트 수정 0건

**1009개 전부 통과, 테스트 파일은 한 줄도 고치지 않았습니다.**

이게 이 작업에서 가장 중요한 지점입니다. 테스트들이 IME 차단 시 로그 문구를 **정확히**
단언합니다.

```ts
expect(consoleWarn).toHaveBeenCalledWith(
  'Bold blocked: IME composition in progress'
)
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

| 항목                                  | 수치                      |
| ------------------------------------- | ------------------------- |
| 단일 함수로 전환                      | 21개 플러그인             |
| → 기계적 변환 (`on`만 있던 것)        | 12개                      |
| → 검증+실행 병합                      | 9개                       |
| 제거된 중복 추출·죽은 재검증          | 9곳                       |
| 플러그인에 남은 `before:`/`after:` 키 | **0개**                   |
| **코드 변화**                         | **25 files, +604 / −719** |

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

---

## 10. C단계 실행 기록 — 타입 부여

### 노선 선택 근거

§4의 두 갈래 중 **Editor.js 노선(버스 유지 + `EventMap`)**을 택했습니다. 결정적이었던 측정:

> **#9(보류 중인 Preact 전환)가 수정한 `packages/react` 파일 21개가 전부 `eventBus` 사용
> 파일과 겹칩니다.**

버스 제거(Lexical 노선)는 그 21개를 다시 건드려야 하므로 보류 중인 PR과 정면 충돌합니다. 반면
타입 부여는 core 한정이고, **나중에 제거 노선으로 갈 때도 페이로드 타입은 어차피 필요합니다.**
버리는 작업이 아니라 선행 작업입니다.

### 구현

**`core/event-map.ts` (신규)** — `EditorEventMap`에 **65종 전부** 등록했습니다.

**`event-bus.ts`** — `emit`/`on`을 조건부 타입 단일 시그니처로 바꿨습니다.

```ts
emit<E extends string>(
  event: E,
  ...args: E extends KnownEventName
    ? EditorEventMap[E] extends void ? [] : [payload: EditorEventMap[E]]
    : unknown[]
): boolean
```

처음에는 오버로드 두 개(엄격 + 느슨한 폴백)로 짰는데, **폴백 오버로드가 오류를 전부 삼켰습니다.**
잘못된 페이로드가 조용히 통과하길래 확인용 probe 파일로 잡았습니다 — `@ts-expect-error`가
"unused"로 뜨는 것이 신호였습니다. 조건부 타입 하나로 합쳐 해결했습니다.

미등록 이름(플러그인 `eventName` 커스텀)은 `unknown[]`으로 남아 기존 유연성이 유지됩니다.

### 타입이 잡아낸 것

맵을 쓰는 행위 자체가 **계약을 강제로 확정시켰고**, 그 과정에서 불일치가 드러났습니다.

**1. 제 맵이 틀린 곳 (타입이 즉시 반박)**

- `AUTOCOMPLETE_SHOW.position` — `{ top, left }`로 적었으나 실제는 `{ x, y }`
- `ALIGNMENT_CHANGED` / `HEADING_CHANGED` — 객체형만 적었으나 **맨값도 받음**(`return data` 폴백)
- `LINK_CHANGED` — URL 문자열도 받음
- `TABLE_CREATE` / `TABLE_INSERT_*` — 전 필드 선택이고 페이로드 자체가 생략 가능 (`cols`의
  별칭으로 `columns`까지 받음)

**2. 플러그인 간 계약 불일치 (전부 `unknown`일 때는 안 보이던 것)**

| 플러그인                                        | 맨값 허용              |
| ----------------------------------------------- | ---------------------- |
| alignment, heading, link                        | **예** (`return data`) |
| font-family, font-size, text-color, line-height | 아니오 (`return null`) |

같은 "값 하나를 받는 이벤트"인데 절반은 맨값을 받고 절반은 안 받습니다. 지금은 맵이 현실을
그대로 기술하게 두었습니다 — **런타임을 바꾸는 건 별개의 동작 변경**이기 때문입니다.

**3. 실제 버그 1건 — `more-menu.tsx:152`**

```ts
action: () => {
  context?.eventBus?.emit(FindReplaceEvents.FIND) // 검색어 없음
}
```

`isFindData(undefined)`가 `false`라 플러그인이 `"Find blocked: Invalid find data"` 경고만 남기고
아무 일도 하지 않습니다. **"Find & Replace" 메뉴 항목이 동작하지 않았습니다.** 같은 파일의
Link·Image·Table 항목은 `// … dialog will be triggered separately`라는 정직한 no-op인데, 이
항목만 동작하는 척하고 있었습니다. 이웃과 같은 명시적 no-op으로 바꿨습니다.

**4. 버그처럼 보였으나 아니었던 것**

`AUTOCOMPLETE_APPLY`를 core가 페이로드 없이 발행하는데 구독자는 `{ word }`를 요구합니다. 버그로
보였지만, 확인해보니 **의도적으로 두 의미를 겸하고 있었습니다** — 페이로드 없음은 "선택된 항목
적용"이고, 팝오버가 이를 받아 `{ word }`를 담아 재발행합니다. 맵을 `{ word } | void`로
기술했습니다.

### 테스트 — negative 테스트를 표시로 승격

의도적으로 잘못된 페이로드를 보내 런타임 거부를 확인하던 테스트 **20곳**이 이제 컴파일 오류가
됩니다. `@ts-expect-error`와 한 줄 설명을 붙였습니다.

```ts
// @ts-expect-error 런타임 검증을 확인하려고 일부러 잘못된 페이로드를 보냅니다
eventBus.emit('FONT_FAMILY_CHANGED', {})
```

이러면 "일부러 잘못된 값"이라는 의도가 코드에 남고, 나중에 런타임 검증을 제거하면 이 지시자가
"unused"로 떠서 알려줍니다.

### 결과

| 항목                                      | 수치                                 |
| ----------------------------------------- | ------------------------------------ |
| `EditorEventMap` 등록                     | **65종 / 65종**                      |
| 타입이 잡은 계약 불일치                   | 6건                                  |
| 발견한 실제 버그                          | **1건** (`more-menu` Find & Replace) |
| `@ts-expect-error` 표시한 negative 테스트 | 20곳                                 |
| 테스트                                    | **1009개 통과**                      |

typecheck 통과 / lint 0 errors / build 통과.

### `packages/react` 를 건드린 점

C단계는 core 한정으로 계획했지만, 타입이 `packages/react`에서 오류 3건을 냈고 typecheck가
통과해야 하므로 고쳤습니다 — `more-menu.tsx` 버그 1건과 미사용 import 1건입니다. **#9와 겹치는
파일**이므로 #9를 되살릴 때 충돌 가능성이 있습니다(둘 다 작은 변경이라 위험은 낮습니다).

### 남은 것

- **버스 제거(Lexical 노선)** — 뷰 계층 결정(#9)이 정리된 뒤 재평가. 페이로드 타입이 갖춰졌으므로
  이름 붙은 슬롯으로 옮기는 비용은 이제 낮습니다.
- **맨값 허용 불일치 harmonize** — 위 표의 절반/절반을 어느 쪽으로 통일할지. 동작 변경이라 별도
  판단이 필요합니다.
- **페이로드 가드 6개** — 타입이 컴파일 시점에 막아주지만, 호스트 앱이 JS로 호출하면 여전히
  런타임 검증이 필요하므로 그대로 두었습니다.

---

## 11. 재측정 (2026-08) — 뷰 계층이 정리된 뒤

§6 이 남겨 둔 조건이 충족됐습니다. **뷰 계층 결정이 끝났고**(Preact + kinu,
signals 도입), 상태 알림의 상당수가 이미 버스를 떠났습니다. 그래서 "버스
제거" 를 재평가할 근거를 다시 쟀습니다.

### 계기부터 — grep 으로는 틀립니다

처음에 `grep "before:"` 로 세고 **0** 이 나와서 "3단계가 이미 걷혔다" 고
볼 뻔했습니다. **틀렸습니다.** A단계(§8)가 가드를 `definePlugin` 안으로
옮겼기 때문에 플러그인 파일에는 안 적혀 있을 뿐, `before` 는 살아 있습니다
(`define-plugin.ts:293`).

그래서 아래 수치는 **앱을 통째로 띄운 뒤 버스 내부를 들여다본 것**입니다.
소스 검색이 아니라 실행 중인 구독 맵을 셌습니다.

### 수치

|                             | §3 (당시) | 지금   |
| --------------------------- | --------- | ------ |
| `eventBus` 참조 파일        | 61        | **58** |
| 구독(`on`)                  | 89        | **70** |
| 이벤트 종수                 | 65        | **76** |
| UI 가 발행하는 명령         | —         | **49** |
| UI 의 `useEditorEvent` 구독 | —         | **8**  |

이벤트를 역할로 나누면 (`EVENT_KIND`, §10 의 타입 작업에서 나온 표) —

| 역할             | 종수   |
| ---------------- | ------ |
| `request` (명령) | **50** |
| `notify` (알림)  | **26** |

### 팬아웃 — 결정적인 숫자

**명령 50종 전부 실제 소비자가 1개입니다. 팬아웃 0.**

처리자가 2개로 보이는 36종을 열어 보니 두 번째는 **같은 플러그인이 `before`
에 다는 IME 조합 가드**였습니다. 남이 듣는 게 아닙니다.

```
■ BOLD_CLICKED
   [before] () => !isBlockedByComposition(...)      ← 같은 플러그인의 가드
   [on]     (data) => handler(...)                  ← 유일한 소비자
```

알림 쪽은 사정이 다릅니다.

| 구독자 수 | 종수                |
| --------- | ------------------- |
| 0개       | **16**              |
| 1개       | 6                   |
| 2개       | 3                   |
| 5개       | 1 (`STYLE_CHANGED`) |

**팬아웃이 실재하는 것은 26종 중 4종뿐**이고, 16종은 harness 구성에서 아무도
안 듣습니다. (구성에 따라 달라질 수 있으므로 "죽었다" 고 단정하지는 않습니다 —
플러그인을 다 켠 상태에서 다시 세야 합니다.)

### 확장점(역할 ④) 은 사용자가 없습니다

§3 이 버스를 남길 근거로 든 "호스트 확장점" 을 실제로 쓰는 곳을 셌습니다.

| 확장점                     | 실사용 |
| -------------------------- | ------ |
| `eventName` 로 이름 재지정 | **0**  |
| `getEventBus()`            | **0**  |
| `core.exec()`              | **0**  |

전부 **자기 정의와 JSDoc `@example` 블록뿐**입니다. 플러그인이
`defaultOptions` 에 자기 기본 이름을 적는 것은 재지정이 아닙니다.

### 바꾸면 없어지는 것 (실측)

| 항목                               | 수치                                    |
| ---------------------------------- | --------------------------------------- |
| `data?: unknown` 시그니처          | **47**                                  |
| 손으로 쓴 런타임 타입 가드         | **29**                                  |
| 계약을 지키려고 쓴 브라우저 테스트 | 1개 (`event-contract.browser.test.tsx`) |

마지막 것이 상징적입니다. 그 테스트는 **첫 실행에서 `AUTO_SAVE_RESTORE`/
`AUTO_SAVE_CLEAR` 에 처리자가 없는 것을 잡았습니다.** 직접 호출이었다면 그건
테스트가 아니라 **컴파일 오류**였습니다.

### 진단

**팬아웃 0인 버스는 결합을 끊는 게 아니라 한 겹 끼워 넣은 것입니다.**
명령 쪽에서 버스가 사 주는 것이 남지 않았습니다 — 확장점은 사용자가 없고,
거부권은 IME 가드 하나이며, 그마저 이미 중앙화돼 있습니다.

알림 쪽은 다릅니다. `STYLE_CHANGED` 처럼 진짜로 여럿이 듣는 것이 있고,
그건 버스가 아니라 **signals 가 더 잘하는 일**입니다 (§3 의 대체 수단 표).

---

## 12. D단계 — 명령 이전 계획

§11 의 측정 위에서 세웁니다. **한 번에 걷어내지 않습니다.** 각 단계가
독립적으로 되돌릴 수 있고, 각자 게이트가 있습니다.

### 원칙

1. **게이트를 통과 못 하면 그 단계에서 멈춥니다.** 다음 단계로 밀지 않습니다.
2. **각 단계는 되돌릴 수 있어야 합니다.** D1·D2 는 두 경로가 공존하므로
   되돌리기가 곧 "새 경로를 안 쓰는 것" 입니다.
3. **타입 오류가 체크리스트입니다.** 옮길 곳을 사람이 세지 않습니다.

### D1 — 명령 표면 만들기 (비파괴적)

편집기 핸들에 **타입 붙은 명령 메서드**를 답니다. 구현은 당분간 안에서
`emit` 을 부르므로 **아무것도 안 깨집니다.**

```ts
editor.commands.bold()
editor.commands.setHeading({ level: 2 })
```

- 목록은 `EVENT_KIND` 의 `request` 50종에서 **생성**합니다. 손으로 적으면
  둘이 갈라집니다
- 페이로드 타입은 `EditorEventMap` 을 그대로 씁니다 (§10 에서 이미 붙여 뒀습니다)

**게이트** — `event-contract.browser.test.tsx` 통과. core/ui 테스트 무변경.
**되돌리기** — 새 표면을 안 쓰면 그만입니다.

### D2 — UI 호출부 이전 (49건)

`packages/ui` 의 `eventBus.emit(...)` 을 `editor.commands.*` 로 바꿉니다.

- 49건, 갈래는 `ContentEvents` 13 · `ParagraphEvents` 7 · `TextStyleEvents` 6 ·
  `FontEvents` 6 · `FindReplaceEvents` 6 · 나머지 12
- **한 갈래씩** 옮깁니다. 갈래마다 커밋 하나

**게이트** — ui 테스트 66개 통과, `packages/ui` 의 `emit` 호출 **0**.
**되돌리기** — 갈래 단위 revert.

### D3 — 얇은 플러그인 층 걷기

§3 이 지적한 이중 디스패치를 없앱니다. 지금 Bold 는 —

```
emit(BOLD_CLICKED) → 버스 → 플러그인(가드 + runCommand + emit(STYLE_CHANGED))
                                            → CommandRegistry
```

플러그인이 하는 일이 **가드 + 위임 + 알림** 뿐이면 명령이 레지스트리를 직접
부르고, 가드는 **명령 데코레이터**로 올립니다.

- 얇은 플러그인이 몇 개인지는 **아직 안 셌습니다.** D3 착수 전에 셉니다
- 얇지 않은 것(표·이미지·찾기)은 그대로 둡니다

**게이트** — IME/composition 테스트 전부 통과. 조합 중 서식 명령이 여전히
막히는지 브라우저에서 확인.
**되돌리기** — 플러그인 단위.

### D4 — 알림 쪽 판단 (별개 결정)

D3 까지 끝나면 버스에 남는 것은 알림 26종입니다. 여기서 다시 재고 정합니다.

- 플러그인을 **다 켠 상태**에서 구독자 0인 16종을 다시 셉니다. 진짜로 죽은
  것이면 지웁니다
- 팬아웃 4종(`STYLE_CHANGED` 외)은 signals 로 옮길 후보입니다
- **에러 안전망**(§3 이 짚은 것)을 어디에 둘지 이 단계에서 정합니다

D4 를 **안 하기로 결정해도 D1~D3 은 그대로 값을 합니다.** 알림용 버스는
팬아웃이 실재하므로 남길 이유가 있습니다.

### 안 하는 것

- **`packages/core` 의 프레임워크 독립을 깨지 않습니다.** 명령 표면은 평범한
  메서드라 Preact 를 끌어들이지 않습니다
  ([`app-or-library.md`](./app-or-library.md) §4 — 테스트 경계로서의 독립)
- **플러그인 시스템을 없애지 않습니다.** 없애는 것은 *명령 전달 경로*이지
  확장 지점 자체가 아닙니다
- **한 번에 큰 PR 로 하지 않습니다.** D2 만 해도 49곳입니다

### 아직 안 잰 것

솔직히 적어 둡니다. 계획의 근거가 아직 없는 부분입니다.

- **얇은 플러그인의 수** — D3 의 크기를 좌우합니다
- **구독자 0인 16종이 진짜 죽었는지** — harness 구성에서만 잰 것입니다
- **D2 의 테스트 파급** — A·B단계에서는 각각 0건·1파일이었지만 그게 여기에도
  적용되리라는 근거는 없습니다
- **사용자가 겪는 이득** — 없습니다. 이 작업이 고치는 사용자 문제는 **0** 이고,
  얻는 것은 타입 안전과 죽은 명령 검출입니다. 그게 충분한지는 판단의 영역입니다
