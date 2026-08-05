# kinu 도입 검토 — base-ui 대체 스파이크

> 상태: 스파이크 완료 · 결정 대기 · 대상: `sagak-ui`
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

1. **`link-dialog` 하나를 실제로 옮겨봅니다** — 스타일까지 포함한 진짜 비용이 나옵니다.
   다이얼로그 5개 중 가장 단순한 것이라 대표성이 있습니다.
2. 그 결과로 **"kinu 디자인을 받아들일 것인가"**를 판단합니다. 받아들이면 나머지 11개는
   기계적이고, 덮어쓸 거면 이 건은 다시 계산해야 합니다.
3. Safari/Firefox에서 `<option>` 서체와 anchor positioning을 확인합니다.

## 아직 확인하지 않은 것

- **Chromium 외 브라우저** — 폰트 미리보기, `commandFor`, anchor positioning 전부 Chromium
  결과 하나뿐입니다.
- **스타일 재정의 비용** — §5 ①의 180곳이 실제로 어떻게 되는지는 1개 이전 전에는 추정입니다.
- **접근성** — base-ui는 포커스 트랩·ARIA를 검증된 형태로 제공합니다. kinu는 플랫폼
  기본(`<dialog>`)에 기대는데, sagak의 a11y 요구를 만족하는지 확인하지 않았습니다.
