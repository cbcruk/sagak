# 선택 영역 상태를 어떻게 나눌 것인가 — preact 를 살리는 방향

`alignment-buttons.tsx` 의 이 `useEffect` 에서 출발합니다.

```ts
useEffect(() => {
  document.addEventListener('selectionchange', updateAlignment)
  const unsubStyle = eventBus.on(CoreEvents.STYLE_CHANGED, 'after', updateAlignment)
  const unsubRestore = eventBus.on(CoreEvents.CONTENT_RESTORED, 'after', updateAlignment)
  return () => { /* 셋 다 해제 */ }
}, [eventBus, updateAlignment])
```

## 1. 지금 상태 — 같은 블록이 여섯 벌

같은 세 소스(`selectionchange`, `STYLE_CHANGED`, `CONTENT_RESTORED`)를 여섯 곳이
각자 구독합니다.

`alignment-buttons`, `list-buttons`, `link-dialog`, `table-dialog`,
`image-dialog`, `use-font-state`.

문제는 반복 자체보다 **가드가 제각각**이라는 것입니다.

| | IME 가드 | 에디터 범위 확인 | rAF 지연 |
|---|---|---|---|
| `use-font-state` | O | O | O |
| `alignment-buttons` | X | O | X |
| `list-buttons` | X | O | X |
| `link-dialog` | X | X | O |
| `table-dialog` | X | X | O |
| `image-dialog` | X | X | O |

세 가지를 다 갖춘 건 하나뿐입니다. 나머지는 조합이 전부 다릅니다.

**그리고 올바른 버전은 이미 core 에 있습니다.** `EditorCore.setupFormattingStateTracking()`
이 IME 가드 + rAF + 범위 확인을 갖추고 `FORMATTING_STATE_CHANGED` 를 발행합니다.
다만 그 페이로드는 굵게/기울임 같은 인라인 서식뿐이라, 정렬·목록·링크·표·이미지를
보려는 컴포넌트는 각자 다시 만들었습니다.

## 2. 비용 — 측정값

캐럿이 한 번 움직일 때 무슨 일이 벌어지는지 세어 봤습니다. 각 파생 함수는
`window.getSelection()` 으로 시작하므로 그 호출 수를 지표로 씁니다.

| | `getSelection` 호출 |
|---|---|
| `selectionchange` 1회 (평상시) | **21회** |
| `selectionchange` 1회 (한글 조합 중) | **8회** |

**21회.** 여섯 구독자가 각자 DOM 을 훑고, 일부는 조상 체인을 끝까지 올라갑니다.

### 가설이 반쯤 틀렸습니다

"IME 가드가 없으니 조합 중에도 전부 돈다" 고 예상했는데, 재보니 **38%**(8회)만
돕니다. 가드를 가진 `use-font-state` 와 core 의 추적이 빠지기 때문입니다.
남은 8회가 가드 없는 다섯 구독자입니다.

한글 한 글자를 조합하는 동안 keystroke 마다 8번씩 선택 영역을 훑습니다. 심각한
버그는 아니고 — 파생값이 안 바뀌면 preact 가 리렌더를 건너뛰므로 화면은 멀쩡합니다 —
**낭비이고, 무엇보다 규약이 없다는 신호**입니다.

## 3. 선택지

### A. 공유 훅 하나 (의존성 없음)

`useSelectionDerived(derive)` 같은 훅을 만들어 구독·가드·rAF 를 한 곳에 두고,
컴포넌트는 파생 함수만 넘깁니다.

- 가드 불일치가 사라집니다. 규약이 한 곳에 생깁니다.
- 구독은 여전히 컴포넌트 수만큼이지만 (훅이 각자 `useEffect` 를 걸므로),
  공통 소스를 모듈 수준에서 한 번만 구독하도록 짜면 1개로 줄일 수 있습니다.
- 파생 계산 자체는 그대로 6회 — 각자 다른 것을 계산하므로 줄지 않습니다.
- **비용 0.** 새 개념도, 번들 증가도 없습니다.

### B. `@preact/signals` (권장)

preact 가 내놓은 답입니다. 선택 영역을 신호 하나로 두고, 파생값을 `computed` 로
만듭니다.

```ts
const selectionVersion = signal(0)      // 가드를 통과한 변경만 여기서 올립니다
const alignment = computed(() => { selectionVersion.value; return getCurrentAlignment() })
const listType  = computed(() => { selectionVersion.value; return getCurrentListType() })
```

- **구독 1개.** 소스 세 개를 모듈 수준에서 한 번만 구독합니다.
- **파생은 지연 평가됩니다.** `computed` 는 실제로 읽힐 때만 계산합니다. 다이얼로그가
  닫혀 있으면 그 파생은 아예 돌지 않습니다 — 지금은 6개가 무조건 다 돕니다.
- **리렌더가 좁아집니다.** 값이 바뀐 컴포넌트만 다시 그립니다. JSX 안에서 신호를
  직접 읽으면 컴포넌트 렌더를 건너뛰고 텍스트 노드만 갱신합니다.
- `useEffect` + `useState` 조합이 컴포넌트에서 사라집니다.

**비용:** `@preact/signals` + `signals-core` 합쳐 **약 3.7 KB gzip**. 현재 앱 번들이
gzip 59 KB 이므로 6% 증가입니다. preact 10.28 은 peer 요구(`>= 10.25`)를 만족합니다.

### C. core 의 `FORMATTING_STATE_CHANGED` 확장

이미 있는 중앙 추적의 페이로드에 정렬·목록·링크 여부를 더합니다.

- 가드가 이미 올바릅니다. 새 개념이 없습니다.
- 다만 **core 가 UI 가 무엇을 보고 싶은지 알아야 합니다.** 표·이미지처럼 UI 사정인
  것까지 core 페이로드에 넣으면 경계가 흐려집니다. `docs/event-bus-refactor.md` 에서
  줄여 온 방향과 반대입니다.

## 4. 판단

**B 를 권합니다.** 이유는 번들이나 유행이 아니라 **지연 평가**입니다.

지금 구조의 진짜 낭비는 "여섯 번 구독한다" 가 아니라 **"닫혀 있는 다이얼로그 5개가
캐럿이 움직일 때마다 DOM 을 훑는다"** 입니다. 표 다이얼로그가 닫혀 있어도
`findTableAtSelection()` 이 돕니다. 이건 훅으로 묶어도 그대로입니다 —
`computed` 의 지연 평가만이 없앱니다.

A 는 가드 불일치를 고치지만 21회는 그대로입니다. B 는 둘 다 해결합니다.

다만 **A 를 먼저 해도 손해가 아닙니다.** 가드를 한 곳에 모으는 작업은 B 로 갈 때도
그대로 쓰이고, 신호를 도입하지 않기로 해도 남습니다.

### 하지 말아야 할 것

`21회` 를 이유로 성능 문제라고 말하지 않습니다. 재보면 캐럿 이동 한 번에
21회이고, 그게 체감 지연으로 이어진다는 근거는 아직 없습니다. **정리해야 할
이유는 규약이 여섯 갈래로 갈라져 있다는 것이고**, 성능은 따라오는 것입니다.

## 5. 밟을 순서

1. **가드를 한 곳으로** (A) — 여섯 벌의 구독을 공유 훅으로 모으고 IME·범위·rAF 를
   통일합니다. 테스트로 조합 중 훑기가 0 이 되는 것을 고정합니다.
2. **신호 도입** (B) — `@preact/signals` 를 넣고 파생을 `computed` 로 옮깁니다.
   닫힌 다이얼로그의 파생이 돌지 않는 것을 테스트로 고정합니다.
3. **측정** — 1·2 각각에서 `getSelection` 호출 수를 다시 재고 노트에 남깁니다.

각 단계는 따로 머지할 수 있고, 2 를 안 하기로 해도 1 은 남습니다.
