# Preact 뷰 전환 + EventBus 작별 설계 노트

> 상태: 제안(Draft) · 대상: `sagak-editor` + `sagak-core`
> 관련: [`signals-adoption.md`](./signals-adoption.md), [`reference-codemirror-state.md`](./reference-codemirror-state.md), [`execcommand-migration.md`](./execcommand-migration.md)

## 요약 (결론 먼저)

1. **`preact/compat` 호환성 스파이크는 통과했습니다.** `sagak-editor`가 쓰는 base-ui 컴포넌트
   4종(dialog·select·menu·toggle)이 실제 브라우저에서 React와 **동작 차이 없이** 렌더·조작됩니다.
   동일 앱을 React로 빌드한 대조군과 결과가 완전히 일치합니다.
2. **뷰 전환의 자체 코드 비용은 거의 없습니다.** 이 저장소는 Preact에 없는 React API를 하나도
   쓰지 않습니다.
3. **EventBus는 signals 하나로는 대체되지 않습니다.** signals가 상태를, CustomEvent가
   명령·거부권·확장점을 가져가는 분업이어야 완전히 사라집니다.
4. **남은 결정은 기술이 아니라 제품입니다** — React 소비자를 계속 지원할 것인가.

---

## 1. 스파이크: `preact/compat` × base-ui

### 왜 이것부터인가

`sagak-editor`의 컴포넌트 23개 중 **12개**가 `@base-ui/react`에 의존합니다.

```
toolbar, heading-select, font-family-select, font-size-select,
line-height-select, letter-spacing-select, export-menu,
table-dialog, image-dialog, link-dialog,
find-replace-dialog, special-character-dialog
```

Base UI는 React 19 세대 라이브러리로 portal·floating-ui·focus manager를 내부에서 씁니다.
여기서 막히면 base-ui를 걷어내고 직접 구현해야 하므로 비용이 급증합니다. **계획 전체의 값이
이 한 지점에 달려 있어** 가장 먼저 확인했습니다.

### 방법

저장소와 동일한 버전(`@base-ui/react` 1.0.0)으로 독립 vite 프로젝트를 만들고, 실제 사용 형태
그대로 4종을 재현했습니다 — `Dialog.Root/Trigger/Portal/Backdrop/Popup/Title/Close`,
`Select.Root/Trigger/Value/Portal/Positioner/Popup/List/Item/ItemText`,
`Menu.Root/Trigger/Portal/Positioner/Popup/Item`, `Toggle`.

```ts
// vite.config.ts — 전환 시 실제로 쓰게 될 설정
resolve: {
  alias: {
    react: 'preact/compat',
    'react-dom': 'preact/compat',
    'react-dom/test-utils': 'preact/test-utils',
    'react/jsx-runtime': 'preact/jsx-runtime',
  },
},
esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
```

빌드 후 headless Chromium(Playwright)으로 구동하며 `pageerror`/`console.error`를 수집했습니다.
**같은 앱을 React 19로 빌드한 대조군**을 동일 스크립트로 돌려 비교했습니다 — preact 단독 결과만
보면 "원래 그런 동작"과 "preact 회귀"를 구분할 수 없기 때문입니다.

### 결과

| 검증 항목 | preact/compat | React 19 (대조군) |
| --- | --- | --- |
| 마운트 | PASS | PASS |
| Toggle `pressed` 전환 | PASS | PASS |
| Select Popup 렌더 (Portal + Positioner) | PASS | PASS |
| Select Popup 위치 계산 (floating-ui) | PASS | PASS |
| Select 값 반영 | FAIL | **FAIL (동일)** |
| Menu Popup 렌더 | PASS | PASS |
| Menu 항목 선택 콜백 | PASS | PASS |
| Dialog Popup 렌더 (Portal + Backdrop) | PASS | PASS |
| Dialog 제어 입력 리렌더 | PASS | PASS |
| Dialog 포커스 트랩 (FloatingFocusManager) | PASS | PASS |
| Dialog Escape 닫기 | PASS | PASS |

**두 환경의 결과가 완전히 일치합니다.** 유일한 FAIL은 양쪽 모두에서 `trigger="5"`로 동일하게
났는데, `<Select.Value />`가 `ItemText`의 label이 아니라 raw value를 렌더하는 **base-ui의 원래
동작**입니다. preact 회귀가 아니라 스파이크 테스트의 기대값이 틀린 것이었습니다.

콘솔 에러는 양쪽 모두 favicon 404 하나뿐입니다.

번들에 React 내부 마커(`__CLIENT_INTERNALS_DO_NOT_USE...`)가 없는 것으로 별칭이 실제로 적용됐음을
확인했습니다.

### 부수 소득: 번들 크기

동일한 앱, 동일한 base-ui:

| | raw | gzip |
| --- | --- | --- |
| preact/compat | 191.2 KB | 66.2 KB |
| React 19 | 361.3 KB | 116.7 KB |
| **차이** | **−47%** | **−43%** |

### 타입 호환성

스파이크의 자체 코드는 `strict: true` + `preact/compat` paths 매핑으로 **0 에러**입니다.

다만 `skipLibCheck: false`로 두면 base-ui의 `.d.ts`에서 **23개 에러**가 납니다 — preact/compat의
타입 표면이 `@types/react`의 완전한 상위집합이 아니기 때문입니다 (`ReactPortal`,
`SyntheticEvent`, `NamedExoticComponent` 부재).

실무상 문제되지 않습니다:

- 저장소는 이미 루트·`packages/react` 양쪽 다 `skipLibCheck: true`입니다.
- 에러는 전부 `node_modules/@base-ui/**` 안이고 자체 코드에는 없습니다.
- 자체 코드가 쓰는 React 타입은 `ReactNode`(59) · `CSSProperties`(42) · `MouseEvent`(3) ·
  `RefObject`(1) · `ChangeEvent`(1)뿐이고 전부 preact/compat에 있습니다.
- base-ui의 타입을 `import type`으로 끌어다 쓰는 곳이 없습니다 (값만 import).

**규율**: 앞으로도 base-ui 타입을 자체 코드로 끌어오지 않습니다. 끌어오는 순간 이 23개가 노출됩니다.

---

## 2. 뷰 전환 비용

### 자체 코드 — 거의 무료

`sagak-editor`가 쓰는 React API 전체입니다.

```
useState 18   useEffect 17   useCallback 11   useRef 7
useMemo 2     useContext 1   createContext 1   type ReactNode 10
```

`useSyncExternalStore`, `useId`, `useTransition`, `useDeferredValue`, `forwardRef`,
`createPortal`, `Suspense`, `lazy` — **하나도 쓰지 않습니다.** 전부 `preact`/`preact/hooks`에
그대로 있고, `ReactNode` → `ComponentChildren` 치환이면 끝납니다.

### 주변 정리

| 항목 | 현재 | 전환 후 | 비고 |
| --- | --- | --- | --- |
| 패키지 이름 | `sagak-editor` | 그대로 | `sagak-react`가 아니라 개명 불필요 |
| 아이콘 | `lucide-react` | `lucide-preact` | 기계적 치환 |
| Storybook | `@storybook/react-vite` | `@storybook/preact-vite` | 스토리 파일 1개뿐 |
| 테스트 | `vitest-browser-react` | preact 대응 필요 | react 패키지 테스트 1개뿐 |
| 코어 테스트 | 65개 | 영향 없음 | 프레임워크 무관 |

---

## 3. EventBus 작별

### 현황 측정

| 항목 | 수치 |
| --- | --- |
| `eventBus` 참조 파일 | 61 (core 37, react 21) |
| `emit` 호출 | 153 |
| 구독(`on`) | 89 |
| 이벤트 상수 | 65종 |
| `(data?: unknown)` 시그니처 | 26 |
| 손으로 쓴 런타임 타입 가드 | 15 |

### 진단 — 버스가 4가지 역할을 겸하고 있다

| 역할 | 성격 | 근거 |
| --- | --- | --- |
| ① 명령 디스패치 | UI → core, **1:1** | 같은 이벤트를 2개 이상 플러그인이 처리하는 경우가 **하나도 없음** |
| ② 상태 알림 | core → 다수 | `STYLE_CHANGED` 구독 10곳, `CONTENT_RESTORED` 6곳 |
| ③ 거부권 | `before` 단계 취소 | 실질 용도는 대부분 IME composition 가드 |
| ④ 호스트 확장점 | 공개 API | `core.exec()`, `getEventBus()`, 플러그인 `eventName` 옵션 |

**역할 ①은 이미 중복입니다.** execCommand 마이그레이션이 `CommandRegistry`라는 두 번째 디스패치
계층을 만들었습니다. 지금 Bold 한 번 누르면:

```
toggleBold()
 → eventBus.emit(BOLD_CLICKED)         ← 디스패치 1
   → 3단계 순회 (before/on/after)
     → bold-plugin.before   IME 가드
     → bold-plugin.on
       → runCommand('bold')
         → eventBus.emit(CAPTURE_SNAPSHOT)
         → registry.run('bold')        ← 디스패치 2
           → precedence 정렬 → 네이티브 구현
       → emit(STYLE_CHANGED)
```

`bold-plugin`이 하는 일은 이제 **IME 가드 + `runCommand` + `STYLE_CHANGED` 발행**이 전부입니다.
실제 서식 로직은 전부 레지스트리 아래로 내려갔습니다.

### 대체 수단 매핑

| 역할 | signals | CustomEvent |
| --- | --- | --- |
| ① 명령 디스패치 | ✗ signal은 "값"이지 "행위"가 아님 | ✓ |
| ② 상태 알림 | ✓ 최적 | △ 구독자가 매번 재조회해야 함 |
| ③ 거부권 | ✗ 개념 없음 | ✓ `cancelable` + `preventDefault()` |
| ④ 호스트 확장점 | ✗ | ✓ |

**둘은 경쟁이 아니라 분업입니다.** 어느 한쪽만으로는 EventBus를 걷어낼 수 없습니다.

이는 [`signals-adoption.md`](./signals-adoption.md)의 결론("signals=상태, EventBus=명령 유지")을
갱신하는 것입니다. 그 노트를 쓸 때는 명령 자리를 대체할 후보를 놓고 보지 않았습니다.

### signals 쪽 — 뷰가 Preact면 계산이 좋아진다

뷰가 Preact면 `@preact/signals`가 렌더링에 **네이티브로** 물립니다. React로 남을 때 필요했던
`useSyncExternalStore` 어댑터가 통째로 불필요해지고, signal 하나가 바뀌면 그 값을 읽는 노드만
갱신됩니다 — 툴바 버튼별 미세 구독이 어댑터 없이 나옵니다.

core는 `@preact/signals-core`, 뷰는 `@preact/signals`를 쓰면 임피던스가 0입니다.
(core의 현재 런타임 의존성은 `dompurify` 하나뿐이므로 의존성 추가는 의미 있는 결정입니다.)

### CustomEvent 쪽 — 걸리는 지점 3가지

**1. 에러 안전망이 사라집니다.** 현재 EventBus는 핸들러 예외를 잡아 `CoreEvents.ERROR`로
재발행합니다 (`event-bus.ts:170-185`). DOM `dispatchEvent`는 리스너 예외를 잡지 않고
`window.onerror`로 흘려보냅니다. `onError` 경로가 그대로 죽으므로 **리스너 등록을 try/catch
래퍼로 감싸 명시적으로 재구현**해야 합니다. 빠뜨리기 쉬운 지점입니다.

**2. 3단계(before/on/after) 순서 보장이 DOM에 없습니다.** DOM은 capture/bubble인데 트리가 있어야
의미가 있고, 단일 EventTarget에서는 무의미합니다. 리스너는 등록 순서로만 실행됩니다.

- 취소 자체는 `preventDefault()`로 커버됩니다 (`dispatchEvent`가 `false` 반환 → 현재 `emit`의
  boolean 계약과 일치).
- 하지만 `definePlugin`의 `{ before, on, after }`는 공개 API이고, `return false`로 취소하는
  지점이 플러그인에 177곳입니다.
- `before`의 주 용도인 IME 가드는 커맨드 레지스트리 미들웨어로 옮길 수 있습니다.

**3. EventTarget을 무엇에 붙일지가 자명하지 않습니다.** `config.element`는 선택 사항이고 모드
전환 시 교체됩니다 (`editor-core.ts:260`). DOM 요소에 붙이면 리스너가 날아갑니다.
→ `EditorCore`가 자체 `EventTarget`을 소유해야 합니다. 이러면 "표준 API라 익숙하다"는 장점은
절반만 남습니다 — 결국 `editor.addEventListener(...)`라는 전용 표면이 됩니다.

### 완화 요인

`emit` 반환값을 실제로 쓰는 곳은 `EditorCore.exec()` **한 군데뿐**입니다. 취소 결과를 호출자가
보는 경로가 거의 없다는 뜻이라, 3단계 API 단순화의 여지가 생각보다 큽니다.

---

## 4. 결정이 필요한 것 — 소비자 대상

기술 문제가 아니라 제품 결정이라 따로 둡니다. 현재 `sagak-editor`는
`peerDependencies: react ^18 || ^19`로 **React 사용자에게 배포되는 라이브러리**입니다.

| 안 | 내용 | 대가 |
| --- | --- | --- |
| **A. React 지원 포기** | Preact 단독 | 가장 단순. 기존/잠재 React 소비자를 버림. 되돌리기 어려움 |
| **B. `preact/compat`로 React 호환 산출물 유지** | Preact를 구현 세부로 은닉 | 소비자가 React 엘리먼트·ref를 경계 너머로 넘기면 깨짐. 툴바 커스터마이징 API를 열 계획이면 특히 위험 |
| **C. `sagak-editor`(React) + `sagak-preact` 병행** | core 공유, 뷰 2벌 | 컴포넌트 23개를 두 번 유지 |

라이브러리 배포가 확실하면 A는 되돌리기 어렵고 C는 유지비가 계속 나갑니다. Preact의 이점을
취하는 게 주목적이라면 **A**가 맞습니다.

---

## 5. 단계 계획

- [x] **0. base-ui × `preact/compat` 스파이크** — 통과 (§1)
- [ ] **1. 뷰 이전** — 자체 코드는 기계적. Storybook/테스트 러너 교체 포함
- [ ] **2. signals로 역할 ②** — `FORMATTING_STATE_CHANGED` + rAF + 타입가드 15개 제거.
      이 시점엔 어댑터 없이 네이티브
- [ ] **3. CustomEvent로 역할 ①③④** — 에러 안전망 재구현을 체크리스트에 명시. 파괴적 변경(major)
- [ ] **4. EventBus 삭제**

순서 근거: 스파이크가 계획 전체의 값을 좌우하므로 0번이 먼저. 뷰가 Preact가 된 뒤에 signals를
넣어야 어댑터를 짓고 다시 버리는 낭비가 없습니다.

---

## 6. 아직 검증하지 않은 것

레거시 어댑터 제거를 검토할 때는 실제로 제거해보고 **188개 실패**를 실측한 뒤 판단했습니다
([`execcommand-migration.md`](./execcommand-migration.md) §6.2). 같은 규율을 적용하면 아직
측정하지 않은 것이 남아 있습니다.

- **EventBus → CustomEvent 전환의 테스트 파급.** 61개 파일 / emit 153 / on 89를 건드리므로
  레거시 어댑터 때보다 규모가 큽니다. 3단계 착수 전에 실측해야 합니다.
- **컴포넌트 23개 전체를 preact로 컴파일한 결과.** 스파이크는 base-ui 사용 형태를 재현한
  것이지 실제 컴포넌트를 옮긴 것이 아닙니다.
- **base-ui의 나머지 prop 표면.** 모듈 진입점 4개는 전부 덮었지만 모든 prop·하위 컴포넌트를
  검증한 것은 아닙니다.
- **Storybook·vitest 러너의 preact 전환.** 설정 교체가 필요하다는 것만 확인했고 실행하지
  않았습니다.

## 범위 밖

- 문서 데이터 모델의 signal화 — [`signals-adoption.md`](./signals-adoption.md) "부적합" 참조
- 블록 기반 에디터(ROADMAP Phase 8)와의 결합
