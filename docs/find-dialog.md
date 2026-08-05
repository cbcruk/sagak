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
