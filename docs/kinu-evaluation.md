# kinu 도입 검토 — base-ui 대체 스파이크

> 상태: 스파이크 + `link-dialog` 실제 이전 완료 · 결정 대기 · 대상: `sagak-ui`
> 관련: [`app-or-library.md`](./app-or-library.md), [`preact-migration.md`](./preact-migration.md)

## 요약

**기술적 장벽은 대부분 넘어갔고, 남은 것은 감수할 것인가의 문제입니다.**

1. **번들 이득은 실측으로 큽니다** — 같은 4종 기준 **gzip 66.2 KB → 17.8 KB**. 앱 전체가
   113.7 KB → **~65 KB** 수준이 됩니다.
2. **사전 평가에서 두 가지를 틀렸습니다** — 폰트 미리보기는 죽지 않고, 제어→비제어 전환도
   `.close()`로 감당됩니다 (§4).
3. **남은 반대 근거는 성숙도와 디자인 주도권**뿐이고, 둘 다 "안 된다"가 아니라 "감수할
   것인가"입니다.

---

## 1. kinu란

Preact 네이티브 UI 툴킷(Jason Miller). 로직을 JS가 아니라 **CSS와 웹 플랫폼 기능**으로
처리합니다 — 소스에 `popover` 47회, `commandFor` 21회, `position-anchor` 6회, `anchor-name`
3회. 60여 컴포넌트를 제공하며 sagak이 쓰는 4종(dialog·select·dropdown-menu·toggle)이 전부
있습니다.

## 2. 스파이크 설계

세 가지를 답하도록 짰습니다.

1. 제어 → 비제어 전환이 견딜 만한가
2. 번들이 실제로 얼마나 주는가
3. 폰트 미리보기가 정말 죽는가

②는 **base-ui 스파이크와 동일한 구성**(4종 + 프레임워크)으로 만들어 직접 비교했고, ①③은
빌드한 결과물을 headless Chromium으로 구동해 확인했습니다. 빌드 성공은 동작이 아니기
때문입니다.

## 3. 결과 — 8/8 통과

| 검증 | 결과 |
| --- | --- |
| Toggle 제어 상태 (`aria-pressed` 전환) | PASS |
| Select 이 네이티브 `<select>` | PASS |
| Select 값 반영 | PASS |
| **`<option>` 에 `font-family` 계산** | **PASS** |
| Dialog 열림 (`commandFor` 비제어) | PASS |
| Dialog 닫힘 | PASS |
| **Dialog 를 코드로 닫기 (`.close()`)** | **PASS** |
| DropdownMenu 열림 | PASS |

### 번들 (같은 4종, 직접 비교)

| | raw | gzip |
| --- | --- | --- |
| base-ui + preact/compat | 191.2 KB | **66.2 KB** |
| kinu + preact | JS 24.0 + CSS 48.5 = 72.5 KB | JS 9.2 + CSS 8.6 = **17.8 KB** |
| **차이** | −118.7 KB | **−48.4 KB** |

sagak 앱 현재 gzip 113.7 KB → **~65 KB**, 약 43% 감소.

## 4. 사전 평가에서 틀린 것

스파이크 전에 반대 근거 셋을 들었는데 **둘이 무너졌습니다.** 기록해 둡니다.

### 틀림 ①: "폰트 미리보기가 죽는다"

`font-family-select`가 각 옵션을 자기 서체로 렌더하는데(`itemStyle(value)`), 네이티브
`<option>`은 OS가 스타일을 통제하므로 "대부분 플랫폼에서 사라진다"고 했습니다.

실제로는 **적용됩니다.**

```
inline="Impact"   computed="Impact"
```

다만 이것은 **Chromium 결과 하나**입니다. `<option>` 스타일링은 역사적으로 플랫폼 편차가 있는
영역이라 Safari/Firefox는 별도 확인이 필요합니다. "대부분 플랫폼에서 사라진다"는 **근거 없이
단정한 말**이었습니다.

### 틀림 ②: "제어 다이얼로그를 못 쓴다"

kinu `Dialog`에 `open`/`onOpenChange`가 없는 것은 맞습니다. 그러나 `<dialog>` 요소의
**`.close()`로 프로그램적으로 닫을 수 있습니다** — 스파이크에서 확인했습니다.

sagak의 "성공 후 자동 닫기"(`setOpen(false)`, `table-dialog` 한 파일에만 8곳)는
`dialogRef.current.close()`로 바뀝니다. 상태를 없애고 ref를 얻는 형태라 기계적입니다.

### 추가로 드러난 것: API가 슬롯 패턴이고 일관성이 없다

`Dialog.Trigger`는 자체 요소를 렌더하지 않고 `applyPropsToChildren`으로 자식에
`commandfor`/`command`를 얹습니다. **실제 요소를 자식으로 넣어야 합니다.**

```tsx
<Dialog.Trigger><Button>Link</Button></Dialog.Trigger>   // 문자열을 넣으면 텍스트로만 렌더됨
```

그리고 **점 표기가 컴포넌트마다 다릅니다.**

| | 형태 | 근거 |
| --- | --- | --- |
| `Dialog` | `Dialog.Trigger` | `Dialog.Trigger = DialogTrigger` |
| `DropdownMenu` | `DropdownMenuTrigger` (별도 export) | `Object.assign(DropdownMenu, {Item})` — Item만 부착 |

처음에 `DropdownMenu.Trigger`를 썼다가 `[object Object]`로 렌더되는 걸 보고 알았습니다. 문서가
아니라 소스와 데모를 읽어야 했습니다.

## 5. 남은 리스크 — 둘 다 "감수할 것인가"

### 리스크 ①: 스타일 주도권 (더 큰 쪽)

kinu는 **CSS 48.5 KB를 들고 옵니다.** 반면 sagak은 자체 인라인 스타일링을 합니다.

| 항목 | 수치 |
| --- | --- |
| `React.CSSProperties` 선언 | 40곳 |
| 스타일 상수/함수 (`triggerStyle`, `popupStyle`, `itemStyle` 등) | 39개 |
| `style={...}` 사용 | **180곳** |
| 자체 CSS | 721줄 |

전환은 **kinu의 디자인을 받아들이거나 전부 덮어쓰는** 선택을 수반합니다. 즉 순수한 기술
교체가 아니라 **디자인 결정**입니다. 이게 이 건의 진짜 비용이고, 번들 이득보다 판단이
어렵습니다.

### 리스크 ②: 성숙도

| 항목 | kinu | base-ui |
| --- | --- | --- |
| 버전 | **0.1.4** | 1.0.0 |
| 저장소 전체 테스트 파일 | **1개** | — |
| 최근 커밋 | 2026-06-04 | — |

§4의 API 일관성 결함(점 표기 불일치)이 그 방증입니다. README의 "polyfill included"에 해당하는
파일도 저장소에서 찾지 못했습니다 — `commandFor`와 CSS anchor positioning은 최신 플랫폼
기능이라, 지원 브라우저 범위 확인이 필요합니다.

## 6. 전환 규모

base-ui 사용 파일 12개:

| 컴포넌트 | sagak 파일 수 |
| --- | --- |
| dialog | 5 |
| select | 5 |
| menu | 1 |
| toggle | 1 |

여기에 스타일 재정의(위 §5 ①)가 얹힙니다.

## 7. 판단과 다음 단계

**기술적으로는 갈 수 있습니다.** 사전에 들었던 반대 근거 셋 중 둘이 실측으로 무너졌고, 번들
43% 감소는 확인된 이득입니다.

**그러나 이건 이제 기술 결정이 아니라 디자인 결정입니다.** kinu를 쓴다는 것은 kinu의 시각
언어를 받아들인다는 뜻이고, 그걸 전부 덮어쓸 거면 번들 이득의 상당 부분(CSS 8.6 KB gzip)을
반납하면서 일만 늘어납니다.

### 권고 순서

1. ~~`link-dialog` 하나를 실제로 옮겨봅니다~~ → **완료 (§8)**
2. 그 결과로 **"kinu 디자인을 받아들일 것인가"**를 판단합니다. 받아들이면 나머지 11개는
   기계적이고, 덮어쓸 거면 이 건은 다시 계산해야 합니다.
3. Safari/Firefox에서 `<option>` 서체와 anchor positioning을 확인합니다.

## 아직 확인하지 않은 것

- **Chromium 외 브라우저** — 폰트 미리보기, `commandFor`, anchor positioning 전부 Chromium
  결과 하나뿐입니다.
- **스타일 재정의 비용** — §5 ①의 180곳이 실제로 어떻게 되는지는 1개 이전 전에는 추정입니다.
- **접근성** — base-ui는 포커스 트랩·ARIA를 검증된 형태로 제공합니다. kinu는 플랫폼
  기본(`<dialog>`)에 기대는데, sagak의 a11y 요구를 만족하는지 확인하지 않았습니다.

---

## 8. `link-dialog` 실제 이전 — 무엇이 나왔나

**동작 검증 7/7 통과, 콘솔 에러 0건.** 링크가 실제로 삽입되고(`<a href="https://example.com">`),
재오픈 시 기존 URL도 채워집니다.

| 검증 | 결과 |
| --- | --- |
| 다이얼로그 열림 (`commandfor`) | PASS |
| 입력 반영 | PASS |
| **닫힘 (프로그램적)** | PASS |
| **링크 삽입** | PASS |
| **기존 URL 미리 채움** (열기 전 실행 순서) | PASS |

### 코드는 줄었습니다

| | 이전 | 이후 |
| --- | --- | --- |
| 파일 | 191줄 | **165줄** (−120/+94) |
| `style={}` | 11곳 | **3곳** |

인라인 스타일 8곳이 kinu CSS로 흡수됐습니다. 툴바 버튼 하나와 버튼 정렬용 flex만 남았습니다.

### 걸림돌 1 — `ref` 가 전달되지 않는다

§4에서 "`.close()`로 감당된다"고 했는데, **그 핸들을 얻는 방법이 문제였습니다.**

kinu의 `Dialog.Content`는 함수 컴포넌트이고 Preact는 함수 컴포넌트에 `ref`를 props로 넘기지
않습니다. `ref={dialogRef}`는 조용히 무시되어 `dialogRef.current`가 `null`이고, `.close()`가
실행되지 않아 **다이얼로그가 닫히지 않았습니다.**

증상이 엉뚱하게 나타났습니다 — 다음 번 트리거 클릭이 "`<h2>Insert Link</h2>`가 포인터
이벤트를 가로챈다"며 실패했습니다. 열린 채인 모달이 툴바를 덮고 있었던 것입니다. 레이아웃
문제로 한참 헤맸고, 버튼 위치의 최상위 요소를 `elementFromPoint`로 찍어보고서야 레이아웃은
멀쩡하고 **닫히지 않은 게 원인**임을 알았습니다.

해법은 `id` 명시 + `document.getElementById`입니다. kinu가 `id` prop을 지원하므로 탈출구는
있지만, **ref 대신 id로 DOM 핸들을 얻는 패턴이 다이얼로그 5개 전부에 필요합니다.**

```ts
const dialogId = useId()
const close = () => {
  const dialog = document.getElementById(dialogId)
  if (dialog instanceof HTMLDialogElement) dialog.close()
}
```

### 걸림돌 2 — `Field` 가 배포 패키지에 없다

데모는 `Field`/`Field.Label`을 쓰는데 **npm 배포본의 `index.d.ts`에 export가 없습니다.**
평범한 `<label>`로 대체했습니다. v0.1.4의 패키징 누락입니다.

`ButtonVariant`에 `'primary'`도 없습니다 (`destructive|outline|secondary|ghost|link`, 기본값은
이름 없음).

### 곁가지로 발견한 것 — sagak 설정 버그

가장 오래 붙잡은 오류는 kinu 탓이 아니었습니다.

```
Type 'Element' is not assignable to type 'ReactNode'.
  Property 'children' is missing in type 'VNode<any>' but required in type 'ReactPortal'.
```

`ReactPortal`은 `@types/react` 타입인데, sagak의 tsconfig는 `react`/`react-dom`만
`preact/compat`으로 매핑하고 **`react/jsx-runtime`을 빠뜨리고 있었습니다.** base-ui가 끌어온
`@types/react/jsx-runtime.d.ts`로 흘러가 React 타입 세계가 통째로 딸려 들어왔습니다.

`--traceResolution`으로 추적해서 찾았고, `react/jsx-runtime` 매핑 한 줄로 해결했습니다.
**Preact 전환 때 제가 빠뜨린 것**이고, 두 타입 세계가 만날 일이 없어 지금까지 드러나지
않았습니다. `packages/ui`와 `apps/editor` 양쪽에 추가했습니다.

### 번들 — 아직 판단할 수 없습니다

base-ui를 11개 컴포넌트가 여전히 쓰므로 **둘 다 번들에 들어 있습니다.** 현재 JS 370.2 KB /
CSS 59.6 KB로, CSS가 12.6 → 59.6 KB 늘었습니다(kinu CSS 유입). **번들 이득은 base-ui를 완전히
걷어낸 뒤에야 실현됩니다** — 중간 상태는 오히려 나쁩니다.

이건 중요한 함의입니다: **점진적 이전은 번들 관점에서 손해 구간을 지나야 합니다.**

## 9. 갱신된 판단

기술적으로 **막히는 곳은 없었습니다.** 걸림돌 둘 다 탈출구가 있고, 가장 큰 오류는 kinu가 아니라
sagak 설정 문제였습니다.

남은 것은 여전히 §5의 두 가지이고, 이전 경험으로 조금 더 구체화됐습니다.

- **스타일 주도권** — `link-dialog` 기준으로는 좋은 쪽이었습니다. 인라인 스타일 11 → 3곳,
  코드 26줄 감소. 다만 이건 **kinu의 시각 언어를 받아들인 결과**이고, 나머지 11개도 같은
  선택을 해야 일관됩니다.
- **성숙도** — `Field` 미export가 §5 ②의 구체적 사례로 추가됐습니다.

**남은 결정은 하나입니다: kinu의 디자인을 받아들일 것인가.** 받아들이면 나머지 11개는
기계적이고(다이얼로그 4개는 `id` 패턴 반복), 번들 이득도 그때 실현됩니다. 받아들이지 않고
전부 덮어쓸 거면 이 건은 다시 계산해야 합니다.

### 이전한다면 순서

**한 번에 전부 옮겨야 합니다.** 점진적 이전은 §8의 번들 손해 구간을 오래 끌고, base-ui가
`@types/react`를 계속 물고 있어 타입 마찰도 남습니다.


## 10. 전면 이전 — 실측

§9의 "한 번에 전부 옮겨야 합니다"를 그대로 실행했습니다. 남아 있던 11개 파일을 모두 옮기고
`@base-ui/react`를 의존성에서 제거했습니다.

### 번들 — 이제 판단할 수 있습니다

§8에서 "base-ui를 완전히 걷어낸 뒤에야 실현된다"고 미뤄둔 숫자입니다.
`apps/editor` 프로덕션 빌드 기준, 이전 직전 커밋(`a6e3cbb`)과 비교했습니다.

| | JS | JS gzip | CSS | CSS gzip | **합계 gzip** |
|---|---|---|---|---|---|
| base-ui | 379 KB | 118 KB | 12 KB | 2 KB | **120 KB** |
| kinu | 207 KB | 61 KB | 59 KB | 10 KB | **71 KB** |

전송량 기준 **41% 감소**입니다. CSS 원본은 12 → 59 KB로 늘었지만(kinu는 컴포넌트 전체 CSS를
한 파일로 배포합니다) gzip 후에는 8 KB 차이고, JS에서 57 KB를 돌려받습니다. 모듈 수도
2014 → 1787로 줄었습니다.

§8의 "중간 상태는 오히려 나쁩니다"가 정확히 그랬습니다 — 둘 다 실린 상태에서는 JS 370 KB /
CSS 59.6 KB였습니다.

### 코드

11개 파일 2269 → 1605줄, 인라인 `style={}` 138 → 48곳.

| 파일 | 줄 |
|---|---|
| `font-size-select` | 100 → 31 |
| `line-height-select` | 94 → 31 |
| `letter-spacing-select` | 94 → 31 |
| `font-family-select` | 98 → 32 |
| `heading-select` | 100 → 40 |
| `special-character-dialog` | 217 → 139 |
| `export-menu` | 131 → 104 |
| `toolbar` | 215 → 204 |
| `find-replace-dialog` | 331 → 280 |
| `table-dialog` | 369 → 282 |
| `image-dialog` | 520 → 431 |

드롭다운 5개가 가장 크게 줄었습니다. base-ui의 `Select`는 `Root`/`Trigger`/`Portal`/
`Positioner`/`Popup`/`List`/`Item`/`ItemText` 8단 구조라 파일마다 트리거·팝업·항목 스타일
세 벌이 붙어 있었습니다. kinu의 `Select`는 네이티브 `<select>`라 그게 전부 사라지고,
5개가 공유하는 껍데기 하나(`toolbar-select.tsx`, 63줄)로 접혔습니다.

### 반복해서 나온 패턴 세 가지

**① `useId()` + `getElementById`** — §8에서 예고한 대로 다이얼로그 5개 전부에 들어갔습니다.
kinu의 `Dialog.Content`가 Preact에서 `ref`를 DOM으로 넘기지 않기 때문입니다. 한 번 알고 나면
기계적이지만, 다이얼로그마다 3줄씩 붙는 세금입니다.

**② 네이티브 `<select>`에는 `onOpenChange`가 없습니다** — base-ui는 드롭다운이 열릴 때
선택 영역을 저장했습니다(`saveSelection()`). 네이티브에는 그 훅이 없어 포커스가 에디터를
떠나기 *전* 시점인 `mousedown`(마우스)과 `focus`(키보드)에 붙였습니다. `saveSelection()`은
범위가 에디터 밖이면 아무것도 하지 않으므로 두 번 불려도 안전합니다.

**③ 상태 없는 컴포넌트가 더 잘 맞습니다** — kinu의 `ToggleGroup`·`TabList`/`Tab`은
스타일만 담당하고 상태는 호출부에 둡니다. 툴바가 손으로 만들던 세그먼트 컨트롤(모서리
이어붙이기, `margin-left: -1px`, 눌림 색)이 `ToggleGroup` 한 줄로 대체됐고,
특수문자 다이얼로그의 탭도 `aria-selected`만 넘기면 끝났습니다.

### 덤으로 나온 것

- **`FindReplaceDialog`가 Esc로 닫힐 때도 강조가 지워집니다.** 네이티브 `<dialog>`의 `close`
  이벤트에 정리 로직을 붙였기 때문입니다. base-ui 시절에는 `onOpenChange(false)` 경로였고
  같은 동작이었지만, 이제는 어떤 경로로 닫혀도 브라우저가 보장합니다.
- **특수문자 목록의 큰따옴표 두 개가 ASCII `"`였습니다.** 곱은 따옴표(`“` `”`)로 고쳤습니다.
  특수문자 삽입기에서 일반 따옴표를 주고 있었던 셈입니다.
- `kinu/style.css` 임포트를 컴포넌트에서 `src/styles/index.css` 한 곳으로 옮겼습니다.
- `tsup.config.ts`의 `react → preact/compat` alias를 제거했습니다. base-ui가 내부적으로
  `react`를 임포트해서 필요했던 것이고, kinu는 preact 네이티브입니다.

### 검증

헤드리스 Chromium에서 빌드 산출물을 직접 구동해 **33/33 통과**했습니다. 앱 에러 없음
(콘솔에 남은 하나는 테스트가 쓰는 가짜 이미지 URL을 프록시가 막은 것입니다).

Bold 적용·`aria-pressed`·`ToggleGroup` 이어붙임 CSS, 네이티브 `<select>` 여부와 `<option>`
폰트 미리보기 계산, 줄 간격·제목 반영(= 선택 영역 저장/복원이 살아 있음), 다이얼로그 4개의
열기·닫기·실제 삽입, 탭 전환, Esc 닫기 시 강조 제거, 드롭다운 메뉴 열기·항목 클릭 후 닫힘·
실제 파일 내보내기(`document.md`), `link-dialog` 회귀 없음까지 확인했습니다.

gates: typecheck 3개 패키지 · lint 0 errors · core 1009 tests · ui 4 tests.

### 남은 것

- **kinu에 `Field`가 없어** 레이블은 `Label` + 직접 배치입니다(§8과 동일).
- **`autocomplete-popover`, `more-menu`, `color-picker`** 등은 애초에 base-ui를 쓰지 않아
  손대지 않았습니다. kinu의 `Popover`/`DropdownMenu`로 옮길 여지는 있지만 별건입니다.
- **접근성은 다시 봐야 합니다.** §5에서 적었듯 kinu는 플랫폼(`<dialog>`, `popover`)에
  기대고, base-ui의 포커스 트랩 구현과는 다릅니다. 브라우저 검증은 동작을 확인한 것이지
  스크린리더 경험을 확인한 것은 아닙니다.

## 11. 다크 모드 — kinu 도입이 드러낸 것

kinu 를 들이자 다크 모드에서 에디터가 반쪽만 어두워졌습니다.

### 원인

앱 셸(`apps/editor/src/index.css`)은 **kinu 이전부터** `color-scheme: light dark` 와
`Canvas`/`CanvasText` 를 쓰고 있었습니다(앱 진입점을 만든 `bfb2dff`). 그래서 예전에도
다크에서 "어두운 페이지 + 흰 에디터 카드"였고, 그건 나름 의도된 모습으로 읽혔습니다.

kinu 가 깨뜨린 건 **카드 안쪽의 일관성**입니다. kinu 는 `prefers-color-scheme: dark` 에
반응해 `--k-*` 를 뒤집는데, `packages/ui/src/styles/index.css` 의 하드코딩 색 65곳과
컴포넌트 9곳이 복사해 둔 인라인 버튼 스타일은 흰색 그대로였습니다. 결과적으로 툴바 한 줄에
어두운 셀렉트와 흰 아이콘 버튼이 나란히 놓였습니다.

### 결정 — 크롬은 따라가고, 종이는 밝게

편집 영역은 다크 모드에서도 흰색으로 둡니다. 본문 글자색은 사용자가 `ColorPicker` 로
직접 지정할 수 있고(기본은 검정), 내보낸 HTML 도 흰 배경을 전제합니다. 배경만 뒤집으면
사용자가 검정으로 칠한 글자가 사라집니다. Google Docs 가 택한 것과 같은 절충입니다.

`color-scheme: light` 를 편집 영역에 명시해 스크롤바와 폼 컨트롤도 종이 쪽을 따르게 했습니다.

### 토큰 두 무리

```css
--sagak-chrome-*  /* hsl(var(--k-*)) — kinu 를 따라 뒤집힙니다 */
--sagak-paper-*   /* 고정된 밝은 값 */
--sagak-accent*   /* 두 테마에서 동일 */
```

### 인라인 버튼 스타일 9벌 → `ToolbarButton` 하나

`{ border: '1px solid #d4d4d4', background: '#fff', color: '#333', width: 28, height: 26 }`
가 컴포넌트 9곳에 복사되어 있었습니다. 색을 한 곳에 모으지 않고는 테마를 따라가게 만들
방법이 없어서 `ToolbarButton` 으로 합쳤고, 색은 `[data-part='icon-button']` 한 곳에만
있습니다. 이어붙인 세그먼트(정렬·실행취소·들여쓰기)도 `[data-part='icon-button-group']`
으로 통일했습니다.

`ToolbarButton` 은 나머지 prop 을 그대로 `<button>` 에 넘깁니다. kinu 의 `Dialog.Trigger` /
`DropdownMenuTrigger` 가 자식에 `commandfor`/`command` 를 얹는 방식이라, 그 속성이 실제
버튼까지 닿아야 하기 때문입니다.

### 곁다리로 정리한 것

- **죽은 CSS 255줄.** `[data-scope='dropdown']`·`[data-scope='dialog']`·
  `[data-scope='color-picker']` 세 scope 는 어느 컴포넌트도 그 속성을 내보내지 않았습니다.
  base-ui 시절 마크업의 잔해입니다. 724 → 469줄.
- **`[data-part='root']` 에 걸린 종이 배경이 무의미했습니다.** 마운트되는 DOM 에는 그
  래퍼가 없고 `wysiwyg` 가 컨테이너 바로 아래에 옵니다. 라이트 모드에서는 컨테이너가
  흰색이라 드러나지 않았고, 다크로 바꾸자 바로 보였습니다.
- **`list-buttons` 를 kinu `DropdownMenu` 로 옮겼습니다.** 직접 만든 팝오버와
  click-outside `useEffect` 가 사라졌습니다.

### 검증

라이트·다크 두 스킴에서 **26/26 통과**. 종이가 두 테마에서 흰색인지, 크롬이 테마를
따르는지, 아이콘 버튼과 셀렉트 배경이 서로 어긋나지 않는지(이번 이슈의 핵심),
흰 종이 위 표 테두리가 보이는지, 대비가 기준을 넘는지를 계산해 확인했습니다.
아이콘 전용 버튼은 WCAG 그래픽 기준 3:1, 텍스트는 4.5:1 을 적용했습니다.

기존 기능 검증 33/33 도 그대로 통과합니다.

### 이 과정에서 잡은 내 실수

색을 토큰으로 일괄 치환하면서 **`:root` 블록 안의 정의까지 바꿔버렸습니다.**
`--sagak-accent: #007aff` 가 `--sagak-accent: var(--sagak-accent)` 가 되어 자기 자신을
가리켰고, 그러면 CSS 변수는 빈 값이 됩니다. 활성 정렬 버튼의 배경이 `transparent` 로
계산됐는데, 처음 쓴 대비 검사가 투명을 검정으로 취급해 **21:1 로 통과 처리했습니다.**
투명 배경을 조상 색으로 합성하도록 검사를 고치고서야 드러났습니다. 검사가 통과했다는
것과 옳다는 것은 다릅니다.

### 고치지 않고 남긴 것

**목록 트리거의 켜짐 상태가 커서를 목록 안에 두어도 갱신되지 않습니다.**
`getCurrentListType()` 이 `selection.anchorNode` 에서 위로만 올라가는데, 선택이
컨테이너 요소에 offset 으로 걸리면(`anchorNode` = DIV, `offset` = 2) 위에 `OL` 이
없어 놓칩니다. `image-dialog` 의 `getSelectedImage()` 는 같은 상황을 세 가지 경우로
나눠 처리하고 있습니다.

병합된 `main` 을 빌드해 같은 시나리오를 돌려 **이전에도 동일하게 동작했음을 확인**했습니다.
이번 변경이 만든 회귀가 아니고, 다크 모드와도 무관해서 별건으로 남깁니다.
