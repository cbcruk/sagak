# CodeMirror 상태 구조 분석 — 참고 노트

> 상태: 참고 자료(Reference)
> 출처: 김태곤, "CodeMirror의 구조 — 상태(state)" (taegon.kim/blog/codemirror-structure-state)
> 관련: [`comparison-wordgard.md`](./comparison-wordgard.md), [`execcommand-migration.md`](./execcommand-migration.md), [`signals-adoption.md`](./signals-adoption.md)

## 배경

CodeMirror 6(이하 CM6)의 상태 계층을 분석한 글입니다. CM6 → ProseMirror → Wordgard로
이어지는 계보(글에서도 확인: PM의 트랜잭션 개념이 CM6에 역수입됨)의 원류라서, 이미 작성한
Wordgard 비교 문서와 겹치는 부분이 많습니다. 이 노트는 **겹치지 않는 새 통찰**과
**sagak에 실질적으로 적용할 항목**만 정리합니다.

## 이미 반영된 것 (재확인)

- **불변 상태 + 트랜잭션 단방향 흐름, 위치 매핑** → `comparison-wordgard.md`에서 동일
  개념(GardState/ChangeSet/mapPos) 분석 완료.
- **facet/StateField** → sagak 규모에는 과함, EventBus 유지로 결정(변경 없음).
- 글의 결론 — "불변이라는 선택이 매핑·구조적 공유라는 다음 선택을 강제한다" — 은 sagak이
  Phase 8(블록 모델)을 통째로 미룬 판단의 정확한 근거입니다. 불변 문서를 채택하는 순간
  매핑과 공유가 옵션이 아니라 의무가 됩니다.

## 새로 참고할 점

### 1. Functional core, imperative shell — 즉시 적용 ⭐

`@codemirror/state`는 DOM API를 전혀 사용하지 않아 브라우저 없이 결정론적으로 테스트됩니다.
sagak의 인라인 서식 엔진(`inline-format.ts`, PR #3)은 핵심 로직(경계 분할·가지 격리·병합)은
순수하지만, 진입 함수가 `window.getSelection()`을 직접 읽어 전역 selection에 결합돼 있습니다.

**적용**: 엔진 코어는 `Range`를 인자로 받고(전역 읽기 없음), 전역 selection 읽기/복원은
얇은 셸 래퍼로 분리. 공개 API는 유지하고 range-in 코어를 추가로 노출합니다.
- 테스트가 전역 selection 설정 없이 Range만 만들어 실행 가능
- Phase 8에서 엔진 재사용 경로 확보

### 2. 델타 기반 undo — `HistoryManager`의 다음 진화 방향 ⭐

CM의 history는 시점별 문서 스냅샷을 쌓지 않고 **각 트랜잭션의 역변환(invert된 ChangeSet)과
선택 영역만 저장**합니다. sagak의 `HistoryManager`는 스냅샷마다 `innerHTML` 전체를 복사하므로
메모리가 O(문서 크기 × 히스토리 깊이)로 증가합니다 — 글쓴이가 회고한 "수 MB 문서도 힘들었던
WYSIWYG"의 바로 그 패턴.

**적용 시점**: 당장은 스냅샷이 단순·견고하므로 유지. **대용량 문서 지원이 요구되는 시점의
1순위 개선**으로 기록. 델타 표현(아래 5번)은 Phase 8 이전에도 도입 가능.

### 3. 문자소 클러스터(grapheme cluster) — 오프셋 연산 점검 항목

`'🤦🏼‍♂️'.length === 7`. 코드유닛 오프셋을 산술 계산하는 코드는 서로게이트 쌍·ZWJ 결합
중간을 자를 수 있습니다.

- **안전**: 엔진의 `splitText(offset)`은 브라우저가 만든 선택 경계(사용자 조작)라 위험 낮음.
- **점검 필요**: find-replace의 검색 위치 연산, autocomplete의 커서 주변 텍스트 처리 등
  **오프셋을 직접 계산하는 지점**.
- **도구**: 이제 `Intl.Segmenter`가 표준(2024년 Firefox v125까지 보급 완료) — CM처럼 자체
  구현(`@marijn/find-cluster-break`)할 필요 없음.

### 4. 원자성 — changes+effects가 한 트랜잭션인 이유

자동완성 예시: 텍스트 삽입(changes)과 팝업 닫기(effect)가 **한 트랜잭션에 담겨** "글자는
추가됐는데 팝업이 떠 있는" 중간 상태가 없습니다. sagak은 `CAPTURE_SNAPSHOT` → 커맨드 실행 →
`STYLE_CHANGED`가 별개 이벤트로 흘러 중간 상태가 관찰될 수 있습니다.

현재는 실용상 문제없지만, 이것이 [`signals-adoption.md`](./signals-adoption.md)의 `batch()`
규율과 Phase 8 트랜잭션 도입의 정확한 동기입니다.

### 5. ChangeDesc 델타 인코딩 + assoc — Phase 8 설계 재료

- **델타 인코딩**: 변경을 `[변경전_길이, 새_길이]` 정수쌍의 플랫 배열로 표현.
  `[n,-1]` 유지 / `[0,n]` 삽입 / `[n,0]` 삭제 / `[n,m]` 교체. 형태(ChangeDesc)와
  내용(ChangeSet=형태+삽입 텍스트)을 분리해, 매핑은 형태만으로 수행.
- **assoc**: 삽입 지점 경계에 걸린 좌표가 삽입 텍스트의 앞/뒤 어느 쪽에 붙을지의 방향성.
  매핑 API 설계 시 필수 파라미터.
- 2번(델타 undo)의 구현 재료이기도 함.

## 채택하지 않을 것

- **Rope/Text 트리 (구조적 공유)** — 수백만 줄 플레인텍스트를 위한 구조. HTML 문자열 IR +
  contentEditable인 sagak에는 적용점이 없음. Phase 8 블록 모델에서 "블록 배열의 구조적
  공유"라는 형태로 재검토.
- **annotation 체계** — 트랜잭션 메타데이터(userEvent/time). 트랜잭션 자체가 없는 현재
  구조에서는 대응물이 없음. Phase 8에서 트랜잭션과 함께 도입 검토.

## 요약

| # | 항목 | 적용 시점 |
| --- | --- | --- |
| 1 | 엔진 순수화 (Range 주입, functional core) | **즉시** (PR #3) |
| 2 | 델타 기반 undo | 대용량 문서 요구 시 |
| 3 | 문자소 클러스터 / `Intl.Segmenter` | 오프셋 연산 코드 점검 시 |
| 4 | 원자성 → `batch()`/트랜잭션 동기 보강 | signals 도입 시 |
| 5 | 델타 인코딩 + assoc | Phase 8 설계 |
