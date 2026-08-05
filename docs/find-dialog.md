# `find-replace-dialog` 의 `useEffect` 정리

`useEffect` 두 개 중 하나는 없앨 수 있었고 하나는 아니었습니다. 그 구분이 이
문서의 요점입니다.

## 1. 없앤 것 — 사용자 동작에 반응하려던 효과

```ts
const [open, setOpen] = useState(false)

useEffect(() => {
  if (open && findText.trim()) {
    handleFind()
  }
}, [caseSensitive, wholeWord])
```

의도는 "체크박스를 바꾸면 다시 찾는다" 입니다. 동작은 했지만 대가가 셋이었습니다.

**① 의존성 배열이 거짓말을 합니다.** 본문은 `open`·`findText`·`handleFind` 를
읽는데 배열에는 `[caseSensitive, wholeWord]` 만 있습니다. 의도한 것이지만,
읽는 것과 선언한 것이 어긋나는 순간 도구도 사람도 도와줄 수 없게 됩니다.

**② `open` 상태가 이것 때문에만 존재했습니다.** 다이얼로그는 `commandfor` 로
열리는 비제어 방식이라 `open` 은 렌더에 쓰이지 않습니다. 확인해 보니 파일
전체에서 `open` 은 선언한 줄과 이 효과의 가드, **두 곳에만** 나옵니다.

**③ 렌더를 한 번 더 기다립니다.** 상태를 바꾸고 → 렌더하고 → 효과가 돌면서
검색합니다.

### 고친 모습

```ts
const setOption = (patch: Partial<FindOptions>): void => {
  setOptions((prev) => ({ ...prev, ...patch }))
  runFind(patch)          // 바뀐 값을 직접 넘깁니다
}
```

`runFind` 가 옵션을 인자로 받으므로 오래된 클로저 문제가 없습니다. 효과가
해결하던 것("상태가 갱신된 뒤에 실행")을 값을 직접 넘겨 해결합니다.

`open` 상태도 함께 사라졌습니다. 체크박스는 다이얼로그 안에 있으니 닫힌
상태에서 바뀔 수 없고, 가드는 애초에 도달 불가능한 경우를 막고 있었습니다.

## 2. 남긴 것 — 외부 구독

찾기 결과를 받는 구독은 그대로입니다. 이건 정당한 `useEffect` 입니다 —
컴포넌트 밖에서 벌어지는 일을 듣는 것이고, 다른 방법이 없습니다.

다만 컴포넌트 밖으로 옮겼습니다(`hooks/use-find-state.ts`). **없앤 게 아니라
옮긴 것**이라는 점은 분명히 해둡니다. 얻은 것은 두 가지입니다.

- 찾기 플러그인이 전용 이벤트가 아니라 `STYLE_CHANGED` 에 `style: 'find'` 를
  실어 보내는데, 그 판별과 페이로드 해석이 한 곳에 모였습니다.
- 컴포넌트에 `useEffect` 가 **0개**가 됐습니다.

## 3. 고치지 않고 기록만 한 것

**`currentMatch` 는 같은 상태 기계를 두 곳에서 굴립니다.**

플러그인의 `FIND_NEXT` 핸들러를 읽어 보면 아무것도 되쏘지 않고 내부
`currentMatchIndex` 만 바꿉니다.

```ts
currentMatchIndex = (currentMatchIndex + 1) % currentMatches.length
```

UI 는 표시할 번호를 알 방법이 없어 같은 산술을 1부터 세는 형태로 흉내 냅니다.
지금은 결과가 맞습니다 — 앞뒤로 여러 번 돌려 확인했습니다. 하지만 플러그인이
인덱스 계산을 바꾸면 UI 는 조용히 어긋납니다.

**플러그인이 인덱스를 실어 보내면 이 계산은 사라집니다.** core 를 건드리는
일이라 별건으로 둡니다. `use-find-state.ts` 주석에 적어 두었습니다.

## 4. 결과

- `useEffect` 2개 → 컴포넌트 **0개** (1개는 훅으로 이동)
- `open` 상태 제거
- 의미 없던 `useCallback` 5개 제거 — memo 된 자식이 없어 아무것도 아끼지
  못하고 있었습니다
- 261 → 238줄

## 5. 검증

`test/find-replace.browser.test.tsx` 4개를 새로 넣었습니다. 리팩토링 **전에**
현재 동작을 먼저 재서(대소문자 무시 3건 → 구분 1건) 같은 값이 나오는지로
확인했습니다.

**체크박스 핸들러에서 `runFind` 를 빼 실제로 실패하는 것을 확인했습니다** —
`1 of 1` 이어야 할 것이 `1 of 3` 으로 남아 2개가 걸립니다.

---

# 이어서 — `useEventBus` 같은 훅을 만들까

`find-replace-dialog` 를 정리하고 나서 같은 모양이 저장소 전체에 몇 개나 있는지
셌습니다. `eventBus.on` 호출이 **10곳**입니다.

## 먼저 확인한 것 — 타입은 이미 있었습니다

`EventBus.on` 의 시그니처를 보면 페이로드 타입이 이미 흐릅니다.

```ts
on<E extends string>(
  event: E,
  phase: EventPhase,
  handler: (payload: PayloadOf<E>) => boolean | void
): Unsubscribe
```

실제로 추론되는지 확인해 봤습니다.

```
StyleChangedPayload      / AutocompleteShowPayload / FindPayload
```

**전부 정확히 추론됩니다.** `docs/event-bus-refactor.md` 의 C 단계가 이걸
만들어 뒀습니다.

그런데 호출부 10곳이 **전부 `(data?: unknown)` 으로 받고** 있었습니다.

```ts
(data?: unknown) => {
  if (!data || typeof data !== 'object') return
  const { status, timestamp } = data as AutoSaveEventData
}
```

이미 컴파일러가 보장하는 것을 런타임에 다시 확인하고, 그러느라 타입을 버리고,
버렸으니 `as` 로 되찾는 순환입니다. **훅이 필요해서가 아니라 있는 타입을 안
쓰고 있었던 게 더 컸습니다.**

## 그다음 — 훅은 무엇을 해결하나

제안받은 형태는 이랬습니다.

```ts
function useEventBus(...args) {
  const { eventBus } = useEditorContext()
  useEffect(() => {
    eventBus.on(...args)
  }, [eventBus])
}
```

이대로는 세 가지가 걸립니다.

1. **해제하지 않습니다.** `on` 이 돌려주는 함수를 반환해야 합니다.
2. **핸들러가 오래됩니다.** 렌더마다 새 클로저인데 의존성에 없으면 첫 클로저를
   붙듭니다. 넣으면 매 렌더 재구독합니다.
3. **가변 인자가 타입을 끊습니다.** `...args` 로 받으면 위에서 확인한
   `PayloadOf<E>` 추론이 죽습니다.

②의 답은 ref 에 최신 핸들러를 담고 구독은 한 번만 하는 것인데, **이 저장소에
이미 두 곳이 손으로 만들어 두고 있었습니다** — `use-editor-error` 에는
"최신 핸들러를 참조하여 effect 재구독을 피합니다" 라는 주석까지 있습니다.

같은 비자명한 패턴이 두 번 손으로 쓰였다는 게 훅을 만들 근거입니다.
③ 때문에 인자는 셋으로 고정했습니다.

```ts
export function useEditorEvent<E extends string>(
  event: E,
  phase: EventPhase,
  handler: (payload: PayloadOf<E>) => void
): void
```

## 결과

| 파일 | 줄 |
|---|---|
| `use-auto-save` | 64 → 46 |
| `use-editor-error` | 61 → 48 |
| `autocomplete-popover` | 174 → 133 |

`(data?: unknown)` 이 UI 코드에서 사라졌습니다. 남은 하나는
`use-editor-signals` 인데, 거기는 이벤트 이름을 **런타임 값**으로 받는 범용
저장소라 `PayloadOf<string>` 이 `unknown` 이 됩니다. 정당한 예외입니다.

`autocomplete-popover` 는 `useEffect` 하나가 넷을 구독하고 해제까지 손으로
챙기던 것이 `useEditorEvent` 네 번으로 바뀌었습니다.

## 검증

**`autocomplete-popover` 에는 테스트가 없었습니다.** 구독 4개를 다 고쳐 놓고
확인 없이 넘어갈 수 없어 먼저 브라우저에서 넷을 다 몰아 보고
(`SHOW` → 항목 3개, `SELECT` 앞뒤, 페이로드 없는 `APPLY` 재발행, `HIDE`),
그대로 `test/autocomplete.browser.test.tsx` 4개로 남겼습니다.

ui 47 → 51.

## 하지 않은 것

`useSelectionDerived` 와 `useFormattingSignals` 는 그대로입니다. 둘 다
**컴포넌트가 아니라 모듈 수준에서 한 번** 구독하므로 `useEditorEvent` 의
모양이 맞지 않습니다. 억지로 맞추면 구독이 다시 컴포넌트마다 생깁니다 —
`docs/selection-state.md` 에서 줄인 것이 되돌아갑니다.
