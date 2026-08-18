# ProseMirror 이주 — 무엇을 사고, 무엇을 짓고, 무엇을 버리는가

> 상태: 제안(Draft) · 대상: `sagak-core` + `sagak-ui`
> 앞선 문서: [`event-bus-refactor.md`](./event-bus-refactor.md) ·
> [`spike-to-product.md`](./spike-to-product.md) · [`phase-8-entry.md`](./phase-8-entry.md) ·
> [`reference-codemirror-state.md`](./reference-codemirror-state.md)
> 스파이크: [`spike/pm-schema`](../spike/pm-schema)

## 요약 (결론 먼저)

1. **버스는 구속조건이 아니었습니다.** 명령 전달은 `commandRegistry` 가 precedence
   체인까지 갖춘 채 이미 있고, 알림은 `subscribe(state, tr)` 하나로 대체됩니다.
   진짜 구속조건은 **문서 모델이 없다**는 것입니다.
2. **모델을 짓지 않고 삽니다.** `prosemirror-model`/`state`/`transform` 을 씁니다.
   [`spike-to-product.md`](./spike-to-product.md) 가 자체 모델을 기각한 근거
   ("플러그인 34개 중 2개만 표현된다")는 **기성 스키마가 대부분 덮으면서 무너집니다.**
3. **지금 문서는 스키마를 통과합니다** — 손실 0/40, 안정 40/40 (§2).
4. **값은 `prosemirror-view` 에 몰려 있습니다.** 모델만 사고 뷰를 직접 지으면 스키마
   제약은 받으면서 제일 비싼 것(IME·`beforeinput`·브라우저 차이)은 그대로 짓습니다.
   그건 가장 나쁜 조합입니다.
5. **무게중심은 서식이 아니라 선택 영역입니다.** `execCommand` 는 56→5 로 줄었지만
   `getSelection` 은 44건 19파일 그대로입니다 (§3).

---

## 1. 왜 지금인가 — 앞 문서들과의 관계

이 저장소는 이미 세 번 같은 자리를 지나갔고, 그때마다 **미루는 것이 옳았습니다.**

| 문서 | 그때 결론 | 지금 달라진 것 |
| --- | --- | --- |
| [`reference-codemirror-state.md`](./reference-codemirror-state.md) | facet/StateField 는 과함, EventBus 유지 | 자체 구현이 아니라 **기성품 도입**이라 비용 구조가 다릅니다 |
| [`spike-to-product.md`](./spike-to-product.md) | 모델 전면 이전 안 함 — 34개 중 2개만 표현됨 | 그 2개가 **스키마 기성품으로 대부분 덮입니다** (§2) |
| [`phase-8-entry.md`](./phase-8-entry.md) | 델타 undo 는 아직 아님 (21.6MB @ 2000문단) | **여전히 아닙니다** — undo 는 이 이주의 근거가 아닙니다 |
| [`event-bus-refactor.md`](./event-bus-refactor.md) | 가드를 제자리에 놓으면 단계가 사라진다 | 그 작업이 이 이주에 **그대로 흡수**됩니다 |

바뀐 것은 성능도 사용자 문제도 아닙니다. **"모델을 직접 지을 것인가"가 "모델을 살
것인가"로 바뀐 것**이고, 그 순간 [`spike-to-product.md`](./spike-to-product.md) §10 이
남의 라이브러리를 기각한 근거("포크 기반 커스터마이징 자산이 크다")가 자기 발밑을
잃습니다 — 코어를 재작성하기로 하면 그 자산이 바로 버려지는 대상이기 때문입니다.

**이 이주가 고치는 사용자 문제는 여전히 0에 가깝습니다.** 얻는 것은 표현할 수 있는
문서의 폭과, 지금은 못 하는 것들(협업·구조적 undo·안정된 붙여넣기)의 가능성입니다.
그게 충분한지는 판단의 영역이고, 이 문서는 그 판단을 대신하지 않습니다.

## 2. 스키마 통과 여부 — 잰 것

[`spike/pm-schema`](../spike/pm-schema) 에서 HTML → 모델 → HTML 왕복을 40건 돌렸습니다.

```
손실 (글자·링크·이미지가 없어지는가)   0 / 40
안정 (두 번 왕복해도 그대로인가)      40 / 40
변화 (마크업이 달라지는가)             8 / 28
```

세 가지를 **따로** 잽니다. 마크업이 달라지는 것은 정규화지 손실이 아니고, 둘을 섞으면
판단이 흐려집니다.

### 2-1. 스키마가 덮는 범위

툴바가 만들 수 있는 것 전부입니다 — 문단·제목·목록·표·이미지·가로줄, 토글 마크 여섯
(굵게·기울임·밑줄·취소선·아래첨자·위첨자), 값 붙는 마크 여섯(글꼴·크기·글자색·배경색·
자간·링크), 문단 속성 셋(정렬·줄간격·들여쓰기).

[`spike-to-product.md`](./spike-to-product.md) 가 "새 노드 스키마 요구" 로 분류한 8개:

| | |
| --- | --- |
| ordered/unordered-list, list-item | `prosemirror-schema-list` |
| table, table-resize | `prosemirror-tables` (병합 속성까지 왕복 통과) |
| image, horizontal-rule | 노드 스펙 몇 줄 |

### 2-2. 달라지는 8건 — 제품에 보이는 변화

```
<ul><li>하나</li></ul>        →  <ul><li><p>하나</p></li></ul>
<b>굵게</b>                    →  <strong>굵게</strong>
<font size="5">큼</font>       →  <span style="font-size: 24px">큼</span>
<font color="#ff0000">빨강     →  <span style="color: rgb(255, 0, 0)">빨강
```

목록 항목의 문단 감싸기는 `li > p` 여백 CSS 를 요구합니다. 레거시 정규화는 오히려
이득입니다 — `execCommand` 시절 문서가 한 번 통과하며 정리되고, `font size="5" → 24px`
는 [최근에 바로잡은 스케일 표](../packages/ui/src/svelte/toolbar-select.specs.ts)를
그대로 씁니다.

### 2-3. 붙여넣기 — 손실 검사가 못 잡는 결함

붙여넣기 12건도 손실 0 이었지만, **글자가 안 없어져도 문서가 망가지는 길**이 있었습니다.

구글 문서는 굵지 않은 글에도 `<b>` 껍데기를 씌우고 `font-weight: normal` 로
되돌립니다. 태그만 보는 규칙은 붙여넣은 문서를 **통째로 굵게** 만들었습니다. 글자는
그대로라 손실 검사를 통과합니다.

그래서 **서식 검사**를 따로 세웠습니다. 이 이주에서 검사 축이 하나 더 필요하다는
증거이기도 합니다 — 내용·구조·서식은 각각 따로 재야 합니다.

구조는 예상대로 풀립니다. 인용·코드블록·정의목록·`<details>` 는 문단이 되고, 스타일
마크가 겹치면 `<span>` 이 다섯 겹까지 쌓입니다. 전자는 **스키마를 늘릴지 정하는 문제**,
후자는 값 붙는 마크 여섯을 `textStyle` 하나로 합칠지 정하는 문제입니다.

### 2-4. 이 측정이 증명하지 않는 것

- **jsdom 이지 브라우저가 아닙니다** — `style` 파싱·직렬화가 다를 수 있습니다.
  §5 의 `produced.browser.test.ts` 가 그 자리를 메우지만 **아직 실행된 적이 없습니다**
- **붙여넣기 표본은 본떠 쓴 것**이지 실제 클립보드 덤프가 아닙니다 — 채집 도구(§5)로
  실물을 받아 픽스처로 바꾸기 전까지 그렇습니다
- 이미지 리사이즈(width/height 변경), 표 셀 속성(colwidth)은 케이스에 없습니다

## 3. 무게중심 — 다시 잰 표면

[`spike-to-product.md`](./spike-to-product.md) 가 "DOM 을 진실로 삼는 표면" 으로 센
두 숫자를 다시 쟀습니다.

| | 그때 | 지금 |
| --- | --- | --- |
| `document.execCommand(` | 56건 / 36파일 | **5건 / 4파일** |
| `getSelection(` | 43건 / 18파일 | **44건 / 19파일** |

**쓰기 경로는 정리됐고 읽기 경로는 그대로입니다.** `execCommand` 는
[`legacy-exec-command.ts`](../packages/core/src/core/legacy-exec-command.ts) 의 최하위
precedence 뒤로 격리됐습니다. 반면 선택 영역은 19개 파일이 `window.getSelection()` 을
직접 봅니다. `state.selection` 이 진실이 되면 그 44곳이 전부 바뀝니다.

**이주 계획에서 제일 큰 덩어리는 서식 커맨드가 아니라 선택 영역입니다.**

## 4. 무엇을 사고 무엇을 짓는가

| 패키지 | 주는 것 |
| --- | --- |
| `prosemirror-model` | Schema · Node · Mark · 위치 체계 · `DOMParser`/`DOMSerializer` |
| `prosemirror-transform` | `Step` · `invert()` · `Mapping` — 역연산이 **구조로** 보장 |
| `prosemirror-state` | `EditorState` · `Transaction` · `Plugin.apply` |
| `prosemirror-view` | contentEditable 소유 · `beforeinput` · **IME/composition** · reconcile |
| `prosemirror-schema-list` · `prosemirror-tables` | 노드 스키마 5개 |
| `prosemirror-history` | 역연산 기반 undo/redo |

`view` 를 빼면 안 됩니다. 스키마 제약은 그대로 받으면서 브라우저별 `beforeinput` 차이와
조합 중 `preventDefault` 가 안 통하는 구간을 우리가 다시 짓게 됩니다 —
[`spike/doc-model`](../spike/doc-model) 2단계가 실측하며 겪은 그 부분입니다.

## 5. 단계

각 단계가 독립적으로 배포 가능해야 합니다. 빅뱅 전환은 하지 않습니다.

### 0단계 — 기준선 (선행, 필수)

브라우저 테스트 전부(core 1,088 · ui 66)가 초록인 지점에 태그를 박습니다. **이걸
안 하면 이주가 깨뜨린 것과 이미 깨져 있던 것을 구별할 수 없습니다.**

### 1단계 — 스키마 확정 ✔ (본체 적용됨)

스키마와 저장 변환은 `packages/core/src/model/` 에 있습니다. 스파이크에서 재고 옮겼고,
그때의 측정(합친 마크 vs 나눈 마크, 인용·코드블록 유무)도 검사로 같이 왔습니다 — 결정을
뒤집고 싶으면 `createSagakSchema` 의 옵션을 바꿔 다시 재면 됩니다.

§2 가 이 단계이고, 스키마 결정 둘은 §7 에서 재서 정했습니다 — **마크는 안 합치고,
인용·코드블록은 넣습니다.**

남은 둘은 브라우저에서 닫습니다.

**실물 문서** — 사용자의 진짜 문서는 그 사람의 오리진에 있어 검사에서 못 봅니다. 대신
**문서가 만들어지는 길 전체**를 재현합니다. 이게 저장된 문서가 겪는 경로 그대로입니다.

```
커맨드 → contentEditable → innerHTML → OPFS → 읽기 → 스키마 왕복
```

`test/model/produced.browser.test.ts` 가 코어의 커맨드 16종을 실제로 돌려 **제품이 만든 마크업**을
읽습니다. 제가 손으로 쓴 픽스처가 아니라는 점이 요지입니다 — `execCommand` 와 네이티브
선택 영역을 거치므로 브라우저마다 결과가 다를 수 있고, 그 차이 자체가 재는 대상입니다.

**실물 클립보드** — 진짜 HTML 은 사람이 복사해야 나오고 검사가 대신할 수 없습니다.
그래서 사람이 2분 쓰면 되는 채집 도구를 뒀습니다.

```
cd spike/pm-schema && npx vite tools      # 붙여넣으면 그 자리에서 왕복 결과
```

**손실 없음**이 아닌 클립보드가 나오면 그게 곧 고칠 거리이고, 픽스처로 복사해
`paste.test.ts` 에 붙이면 회귀 검사가 됩니다.

### 2단계 — 편집 표면 교체 (진행 중: 2a·2b-1 끝, 2b-2 남음)

셋으로 나눴습니다.

| | | |
| --- | --- | --- |
| **2a** | 툴바 커맨드를 `EditorState` 위로 | ✔ `src/model/commands.ts` |
| **2b-1** | 그 커맨드를 레지스트리에 얹기 | ✔ `src/model/register.ts` |
| **2b-2** | `EditorView` 교체 | **남음** |
| **2c** | 선택 영역 정리 | 남음 (4단계와 한 덩어리) |

**왜 커맨드가 뷰보다 먼저인가.** `EditorView` 를 얹는 순간 PM 이 DOM 을 소유합니다.
그때까지 커맨드가 `execCommand` 로 DOM 을 직접 고치고 있으면 모델과 DOM 이 어긋납니다.
커맨드를 먼저 지으면 그 구간이 없습니다 — 뷰 없이 `EditorState` 만으로 돌고 검사되므로
**아무도 안 쓰는 채로 완성**될 수 있습니다.

`registerModelCommands` 는 상태가 `null` 이면 `undefined` 를 돌려줍니다(= 처리하지 않음).
그래서 등록해 둬도 아무것도 안 바뀌고, **뷰가 상태를 내주는 순간 갈아탑니다.**

#### 2b-2 착수 조건과 할 일

1. `WysiwygArea` 재작성 — `EditorView` 소유, `dispatchTransaction` 에서
   `WYSIWYG_CONTENT_CHANGED`·`WYSIWYG_SELECTION_CHANGED` 발행,
   `installStoredMarks`(PM 의 `storedMarks` 가 대신)와 채움용 `<br>` 처리 제거
2. `EditorCore` 가 그 뷰의 `StateHandle` 로 `registerModelCommands` 호출
3. **wysiwyg 검사 41개 이관** — `getRawContent()` 로 DOM 마크업을 직접 보는 것들입니다.
   PM 의 DOM 은 클래스·속성·trailing break 가 붙어 모양이 다르므로 상당수를
   "DOM 이 이렇다" → **"모델이 이렇다"** 로 다시 써야 합니다
4. `selectionManager` 위임 여섯(`insertHTML`·`insertText`·`getSelectedHTML`·
   `getSelectedText`·`execCommand`·`focus` 의 `restoreSelection`)의 거취 — 2c 와 한
   덩어리라 여기서 경계를 정해야 합니다

**중간에 초록이 안 되는 구간이 깁니다.** 지금까지 조각은 전부 각각 초록으로 끝났는데
2b-2 는 처음부터 끝까지 한 번에 가는 편이 낫습니다 — 끊기면 무엇이 깨진 것인지 판별하기
어려워집니다.

### 2단계 준비 — 스파이크 (완료)

`prosemirror-view` 가 편집 영역을 가져갑니다. 제일 큰 덩어리이고 IME 가 여기 있습니다.
이 단계가 끝나면 `editing-area`·`wysiwyg-area`·`stored-marks` 의 `beforeinput` 처리가
사라집니다.

**게이트**: IME/composition 테스트 전부 통과. 한글 조합 중 서식·undo·붙여넣기.

본체를 건드리기 전에 스파이크에서 게이트부터 겁니다
([`view.browser.test.ts`](../spike/pm-schema/test/view.browser.test.ts)). 툴바도 플러그인도
없이 `EditorView` 하나만 올리고 **입력만** 봅니다 — 여기서 안 되는 것은 나중에도 안 됩니다.

한글은 이미 답이 반쯤 나와 있습니다. [`spike/doc-model`](../spike/doc-model) 이 쟀듯
**조합 중 입력은 막을 수 없습니다** — `insertCompositionText` 는 `cancelable === false`
이고 조합 이벤트를 전부 `preventDefault` 해도 글자는 들어갑니다. 그러니 질문은 "막을 수
있는가" 가 아니라 **"PM 이 그 뒤를 제대로 수습하는가"** 입니다.

진짜 조합은 CDP 의 `Input.imeSetComposition` 으로 일으킵니다. `CompositionEvent` 를
직접 dispatch 하는 것은 내 코드가 내 코드를 확인하는 것이라 재는 값이 없습니다.

붙여넣기는 **따로 잽니다.** PM 은 자기 경로(`clipboardParser`)로 처리하므로 §2 의
`DOMParser` 왕복 결과가 그대로 적용된다고 볼 수 없습니다.

### 3단계 — 커맨드·플러그인 34개 이전

`commandRegistry` 의 precedence 체인이 이미 PM 의 명령 모델과 같은 꼴이라, 등록 방식은
유지하고 핸들러 속만 트랜잭션으로 바꿉니다. `execCommand` 5건이 여기서 사라집니다.

### 4단계 — 선택 영역 44곳

`window.getSelection()` → `state.selection`. [`selection.ts`](../packages/ui/src/state/selection.ts)
의 가드 셋(IME·rAF·에디터 범위)은 **통째로 없어집니다** — `prosemirror-view` 의 일입니다.

### 5단계 — 버스 철거

[`event-bus-refactor.md`](./event-bus-refactor.md) 가 센 알림 26종 중 구독자 0인 16종을
지우고, 남는 것을 `subscribe(state, tr)` 로 옮깁니다.

## 6. UI 층은 이 결정에 안 걸립니다

방금 세운 상태 층([`state/`](../packages/ui/src/state/))의 **경계는 그대로 살아남습니다.**

| | PM 이후 |
| --- | --- |
| 덤 컴포넌트 (`HistoryButtons`·`FormatToggles`·`AlignmentButtons`·`ListButtons`) | **한 줄도 안 바뀜** |
| `editor-state.ts` 묶음 | 개념 유지, `derived(state, …)` 로 구현 교체 |
| 도메인 store 들 | 껍데기 유지, push → **pull** |
| `fromBus` | **죽음** — 버스가 없습니다 |
| `fromSelection` · `selection.ts` | **죽음** — `prosemirror-view` 의 일입니다 |
| `toolbar-choice.ts` | **없어질 가능성** — 줄간격·자간이 노드 속성이 되면 읽힙니다 |

그래서 남은 컴포넌트(`AutoSaveIndicator`·`FindReplaceDialog`)를 `fromBus` 로 옮기는
작업은 **접습니다.** 버려질 코드를 쓰는 일입니다.

## 7. 정한 것 — 스키마 결정 둘 (측정)

### 7-1. 값 붙는 마크는 **안 합칩니다**

붙여넣기에서 `<span>` 이 다섯 겹까지 쌓이는 것을 보고 나온 질문입니다. 합치면 겹은
줄지만, ProseMirror 에서 **같은 종류의 마크는 한 번만 붙습니다** — 겹친 `<span>` 은
안쪽이 바깥을 밀어내고 밀려난 속성은 사라집니다.

|  | 겹(깊이) 나눔 → 합침 | 속성 보존 나눔 / 합침 |
| --- | --- | --- |
| 한 span 에 다섯 속성 (구글 문서 꼴) | 5 → 1 | 3/3 / **3/3** |
| 겹친 span 에 서로 다른 속성 (툴바 꼴) | 2 → 1 | 2/2 / **1/2** |
| 세 겹 | 3 → 1 | 3/3 / **1/3** |
| 겹친 것 + 굵게 | 2 → 1 | 2/2 / **1/2** |

**여기서 근거를 한 번 고쳤습니다.** 처음에는 "겹친 `<span>` 은 툴바가 만드는 꼴" 이라고
적었는데, 그건 재지 않고 가정한 것이었습니다. 브라우저에서 제품 커맨드를 실제로 돌려
보니 **같은 범위에 셋을 걸면 한 `<span>` 에 몰아넣습니다.**

```
제품(같은 범위):  <span style="font-family: Georgia; color: rgb(255, 0, 0)">가나다라</span>
```

이 꼴이면 합쳐도 잃을 것이 없습니다. 겹치는 것은 **범위가 다를 때**입니다 — 전체에
글꼴을 주고 앞 두 글자에만 색을 주면 그때 겹칩니다.

```
제품(범위 다름):  <span style="font-family: Georgia"><span style="color: red">가나</span>다라</span>

겹친 글자('가나')에 걸린 스타일
  나눔: color: rgb(255, 0, 0); font-family: Georgia;
  합침: color: rgb(255, 0, 0);          ← 겹친 구간에서만 글꼴이 사라집니다
```

결론은 그대로지만 **이유가 좁아졌습니다.** 합치면 문서가 통째로 망가지는 게 아니라
**겹치는 구간에서 바깥 속성을 잃습니다.** 그 대신 얻는 것은 겹 하나 줄이는 것뿐이라
여전히 안 합치는 쪽입니다.
([`style-marks.test.ts`](../packages/core/test/model/style-marks.browser.test.ts) ·
[`produced.browser.test.ts`](../packages/core/test/model/produced.browser.test.ts))

### 7-2. 인용·코드블록은 **넣습니다**

코드블록이 결정적입니다. 안 넣으면 `<pre>` 가 문단으로 풀리며 **줄바꿈과 들여쓰기가
사라집니다.**

```
function f() {        안 넣음 → function f() {   return 1 }
  return 1            넣음    → <pre><code>function f() {
}                                  return 1
                                 }</code></pre>
```

이건 구조 변화가 아니라 손실인데, **손실 검사가 공백을 지우고 비교하는 바람에 통과하고
있었습니다** (§2 의 `contentOf`). 잣대가 못 보던 자리이고, 이 이주에서 검사 축을 세울 때
같은 함정이 또 나올 수 있습니다.

인용은 그만큼 세지 않습니다 — 글자는 남고 구조만 풀립니다. 코드블록을 넣는 김에 같이
넣습니다. ([`rich-blocks.test.ts`](../packages/core/test/model/rich-blocks.browser.test.ts))

**딸려 오는 일**: `blockquote`·`pre` CSS, 내보내기 경로 확인, 그리고 툴바가 만들 수 없는
것을 문서가 갖게 된다는 것 — 커맨드를 붙일지는 따로 정합니다.

## 8. 정한 것 — 저장 형식은 **JSON** (측정)

`innerHTML` 을 그대로 OPFS 에 넣던 것을 **모델 JSON** 으로 바꿉니다.

**전제**: 사용자가 아직 없어 이관 부담이 없습니다. 이 전제가 이 결정의 전부이고,
사용자가 생긴 뒤였다면 답이 달랐을 것입니다.

### 8-1. 무엇이 좋아지는가

HTML 로 저장하면 **문서를 열 때마다 스키마를 통과합니다.** §2 의 "변화 8건"(목록 항목이
문단으로 감싸지는 것 등)을 매번 겪고, 저장·열기가 반복되며 값이 갉일 여지가 남습니다.
JSON 은 저장한 것이 곧 모델이라 그 왕복이 아예 없습니다.

측정: 무손실 6/6 (`Node.eq`), 안정 6/6 (두 번 돌려도 같은 JSON), HTML 로 되돌리기 6/6.
([`json-storage.test.ts`](../packages/core/test/model/storage.browser.test.ts))

### 8-2. 무엇을 치르는가

**크기가 커집니다.**

| | HTML | JSON | |
| --- | --- | --- | --- |
| 앱 초기 콘텐츠 | 91B | 625B | ×6.9 |
| 표 | 73B | 486B | ×6.7 |
| 겹친 서식 | 87B | 335B | ×3.9 |
| **긴 문서 (문단 200개)** | **11.5KB** | **32.9KB** | **×2.9** |

짧은 표본의 배수는 구조 비용이 부풀려 보이는 것이고, 글자가 대부분인 실제 문서는
**약 3배**로 내려앉습니다. [`document-model.md`](./document-model.md) 가 잰 OPFS 성능이
488KB 쓰기 6.3ms 였으니, 문서 하나가 100KB 대로 커져도 저장 자체는 문제가 아닙니다.

**모르는 것에 관대하지 않습니다.** HTML 파싱은 스키마 밖을 조용히 버리지만
`Node.fromJSON` 은 **던집니다.** 저장물이 깨졌을 때 반쪽 문서로 여는 것보다 낫지만,
**여는 쪽이 그 오류를 받아 화면에 알려야** 합니다 — 지금 `document-store` 에는 그 자리가
없습니다.

### 8-3. HTML 이 사라지는 것은 아닙니다

내보내기·붙여넣기·소스 보기는 계속 HTML 을 씁니다. JSON 은 **저장과 편집의 진실**이고
HTML 은 **바깥 형식**입니다. 그래서 §5 2단계에서 소스 보기 모드의 성격이 바뀝니다 —
지금은 저장 형식을 직접 보는 창이지만, 앞으로는 **모델에서 뽑아낸 표현**이고 손으로 고친
HTML 은 다시 스키마를 통과합니다. 스키마 밖의 손질은 반영되지 않습니다.

## 9. 정한 것 — 저장물이 깨졌을 때와 이름의 확장자

**깨진 저장물은 던지지 않고 담습니다.** `open()` 이 `false` 를 돌려주고 이유를
`documentError` 에 넣습니다. 열던 문서는 그대로 둡니다 — 여는 데 실패했다고 보고 있던
글을 잃으면 안 됩니다. 문서 줄이 그 이유를 `role="alert"` 로 보여 줍니다.

던지기만 하면 사용자에게는 **아무 일도 안 일어난 것**으로 보입니다. 눌렀는데 문서가 안
바뀝니다.

**확장자는 내보낼 때만 답니다.** 저장물은 JSON 인데 기본 이름이 `Untitled.html` 이라
안에 든 것과 이름이 어긋나 있었습니다. 이름은 문서 이름일 뿐이고, `.html` 은 진짜 파일로
나갈 때 그 파일의 형식을 가리키는 자리입니다.

## 10. 미결

- **`li > p` 여백 CSS**
- **번들 크기** — 스키마를 코어에 넣자 **233KB → 306KB (gzip 73 → 95KB)** 로 늘었습니다.
  `prosemirror-model`·`schema-list`·`tables` 값이고 `prosemirror-view` 는 아직 안 들어갔습니다.
  지금은 **제품이 안 쓰는데도 실려 있습니다** — `index.ts` 가 내보내니 앱이 끌고 옵니다.
  2단계에서 실제로 쓰기 시작하면 값을 하지만, 안 쓰는 동안 매다는 게 맞는지는 별개입니다.
  급하면 하위 경로(`sagak-core/model`)로 갈라 놓을 수 있습니다
- **학습 목표와의 관계.** 이 저장소는 "배움의 도구" 라는 합의가 있습니다
  ([`session-doc-model-spike.md`](./session-doc-model-spike.md)). 남의 모델을 사는 것은
  그 배움을 없애는 게 아니라 **바꿉니다** — 짓는 배움에서 읽고 얹는 배움으로. 이건
  성능으로 정해지지 않는 판단이라 그렇게 적어 둡니다
