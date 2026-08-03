# Signals 도입 설계 노트

> 상태: 제안(Draft) · 대상: `sagak-core` + `sagak-editor`
> 관련: [`execcommand-migration.md`](./execcommand-migration.md), [`comparison-wordgard.md`](./comparison-wordgard.md)

> **갱신 (2026-08)** — 아래 "두 리액티비티의 경계"에서 EventBus를 명령 담당으로 **유지**한다고
> 했으나, 이후 검토에서 CustomEvent가 그 자리를 대체할 수 있음을 확인했습니다. signals(상태) +
> CustomEvent(명령·거부권·확장점) 분업으로 EventBus를 완전히 걷어내는 계획은
> [`preact-migration.md`](./preact-migration.md) §3을 참고하세요. 이 노트의 나머지 내용
> (파생 상태에만 signals를 쓰고 문서 모델에는 쓰지 않는다는 원칙)은 그대로 유효합니다.

## 요약 (결론 먼저)

**파생 상태(derived state)에는 signals를 도입하고, 문서 모델(source of truth)에는 도입하지 않는다.**

signals는 "여러 개의 작은 파생 값을 여러 구독자가 지켜보는" 상황을 위한 도구입니다. 에디터의
서식 상태·폰트·선택 파생 값이 정확히 이 케이스입니다. 반면 문서 콘텐츠는 원자적 트랜잭션과
되돌리기 일관성이 필요하므로 signals의 대상이 아닙니다. 이는 Wordgard(ProseMirror/CodeMirror
저자)가 **facet의 파생 값에만 signal-like 의존성 추적을 쓰고, 문서는 트랜잭션으로 다루는** 분업과
동일한 원칙입니다.

## 배경 — 현재 구조의 한계

`sagak-core`는 프레임워크 독립이지만, 리액티비티 수단이 **EventBus(명령형)뿐**입니다. 그 결과
파생 상태의 배포가 다음처럼 흘러갑니다.

```
queryCommandState('bold') ──rAF debounce──▶ emit('FORMATTING_STATE_CHANGED', {...})
                                                    │
        각 React 훅: eventBus.on(...) ──▶ 타입가드 ──▶ setState ──▶ 리렌더
```

- `packages/react/src/hooks/use-formatting-state.ts` 등은 이벤트 payload를 **런타임 타입가드**로
  검증하고 `setState`로 옮기는 보일러플레이트를 반복합니다.
- 하나의 `FORMATTING_STATE_CHANGED`에 툴바 전체가 반응 → 바뀌지 않은 버튼도 리렌더 후보.
- 각 프레임워크 바인딩이 파생 로직을 **다시** 구현해야 합니다(코어가 파생 값을 안 들고 있음).

## 어디에 적용하는가 (적합)

### 1. 파생 편집 상태를 코어의 signal로

`isBold`, `isItalic`, `currentFont`, `currentAlignment` 같은 **선택에서 파생되는 스칼라 값**을
코어에서 `computed`로 노출합니다.

```ts
// sagak-core (framework-agnostic; @preact/signals-core)
editor.state.isBold      // ReadonlySignal<boolean>
editor.state.currentFont // ReadonlySignal<string | null>
```

- **미세 구독**: 툴바 버튼이 각자 필요한 signal만 구독 → 바뀐 것만 갱신.
- **파생 로직 1곳**: 코어가 파생 값을 소유 → 프레임워크 바인딩은 얇아짐.

### 2. 얇은 React 바인딩

`FORMATTING_STATE_CHANGED` 구독 + 타입가드 + `setState` 배선이 사라집니다.

```ts
// Before: 이벤트 구독 + 타입가드 + setState (수십 줄)
// After:
const bold = useSignalValue(editor.state.isBold)
```

`useSignalValue`는 signal 구독 → React 리렌더를 잇는 어댑터 한 개면 충분합니다. Vue/Svelte/vanilla도
동일 signal을 각자 방식으로 구독할 수 있습니다.

### 3. 설정/파생 옵션 (선택)

Wordgard의 facet처럼, "입력 여러 개를 combine한 파생 설정값"이 필요해지면 signal이 자연스러운 토대가
됩니다. 다만 sagak 규모에서 facet 전체 체계는 과할 수 있으니, 필요할 때만 국소적으로 도입합니다.

## 어디에 적용하지 않는가 (부적합)

### 문서 콘텐츠 모델 — signals 금지

문서를 signal 또는 signal 트리로 만들면 안 됩니다.

- 문서 변경은 **원자성**(한 트랜잭션 = 한 번의 일관 변경), **되돌리기 일관성**, **위치 매핑**이
  필요합니다. 콘텐츠를 반응형 셀로 쪼개면 이를 잃습니다.
- Wordgard/ProseMirror는 문서에 signals를 쓰지 않고 **불변 문서 + `ChangeSet`/`Transaction`** 을
  씁니다. signals는 그 **위에서 doc+selection을 파생**하는 층에만 존재합니다.

### contentEditable 결합은 signals가 풀어주지 않음

현재 sagak은 **contentEditable(DOM)이 실제 소스**이고 상태는 DOM에서 조회(`queryCommandState`)됩니다.
signals는 이 결합을 바꾸지 못합니다 — DOM↔signal 동기화는 여전히 필요하고, signals가 돕는 건
"읽기/파생/배포" 쪽뿐입니다. 즉 **execCommand 탈피의 대체가 아니라 상호보완**입니다.

## 두 리액티비티의 경계

EventBus와 signals가 겹치지 않도록 역할을 분리합니다.

| 수단 | 용도 | 성격 |
| --- | --- | --- |
| **EventBus** (유지) | 명령/액션·수명주기 (`BOLD_CLICKED`, `APP_READY`, `CoreEvents.ERROR`) | 명령형 |
| **Signals** (신규) | 상태·파생 값 (`isBold`, `currentFont`, selection 파생) | 선언형 읽기 |

원칙: **"무언가를 하라"는 EventBus, "무엇인가이다"는 signal.**

> 이 표의 "EventBus (유지)"는 이후 갱신되었습니다 — 명령 자리는 CustomEvent가 가져가고 EventBus는
> 제거하는 방향입니다. 원칙 자체("하라"와 "이다"를 다른 수단으로 나눈다)는 그대로이고, "하라" 쪽의
> 구현만 바뀝니다. [`preact-migration.md`](./preact-migration.md) §3 참고.

## 일관성 규율 (glitch 방지)

- 하나의 편집 동작이 여러 파생 값을 바꿀 때는 `batch()`로 묶어 **동작당 한 번만** 갱신되게 합니다
  (중간 상태 노출 방지). CM6가 changes+effects를 한 트랜잭션에 담아 원자성을 보장하는 것과 같은
  원칙입니다 — [`reference-codemirror-state.md`](./reference-codemirror-state.md) §4 참고.
- signal 출력은 가능하면 값 동일성 비교로 안정화하여, 값이 그대로면 구독자가 재실행되지 않게 합니다
  (현재 `editor-core`의 `isStateEqual` 최적화와 같은 취지).

## execCommand 마이그레이션과의 연계

두 작업은 자연스럽게 맞물립니다.

- migration **P0**의 `commands.queryState(name)`가 반환할 값이 곧 `computed` signal로 노출할 값입니다.
  → `queryState`를 signal 기반으로 설계하면 커맨드 추상화와 파생 상태 계층을 한 번에 얻습니다.
- React 훅을 `useSignalValue` 래퍼로 전환하며 `FORMATTING_STATE_CHANGED` + rAF 배선을 제거합니다.
- 장기적으로 문서 모델(ROADMAP Phase 8)을 도입하면, signals는 그 위에서 doc+selection을 파생하는
  층(=Wordgard facet 위치)으로만 둡니다.

## 실무 노트

- **패키지 선택**: 코어는 프레임워크 중립이어야 하므로 `@preact/signals-core`를 사용합니다. 현재
  리포에는 Preact 바인딩인 `@preact/signals`만 devDependency로 있습니다 — 코어 런타임 의존성으로
  `@preact/signals-core`를 추가해야 합니다. (React 바인딩은 `sagak-editor` 쪽 어댑터에서 처리)
- **번들 영향**: `@preact/signals-core`는 매우 작습니다. `sideEffects: false` 유지에 문제 없습니다.
- **테스트**: signal은 순수 값 파생이라 단위 테스트가 쉬움. 기존 브라우저 테스트(선택→상태)는
  그대로 유지하되, 파생 로직 단위 테스트를 코어에 추가합니다.

## 우선순위 / 권고

- 툴바가 작고 성능 이슈가 없다면 **긴급하지 않습니다** — 현재 event+hook도 동작합니다.
- 이득은 **파생 값·구독자가 많아질수록**, 그리고 **멀티 프레임워크 지원**에서 커집니다.
- 따라서 독립적으로 지금 당장보다, **execCommand 마이그레이션 P0과 묶어 "파생 상태 계층"으로 도입**하는
  것을 권합니다. 그 시점에 `queryState` → `computed` 매핑이 가장 자연스럽습니다.

## 범위 밖

- 문서 데이터 모델의 signal화(위 "부적합" 참조).
- facet/compartment 수준의 정교한 설정 반응 시스템(현 규모에서는 과함; 필요 시 국소 도입).
