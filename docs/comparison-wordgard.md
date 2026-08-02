# Wordgard vs sagak 비교 분석

> 상태: 참고 자료(Reference) · 작성 계기: 외부 레퍼런스 조사
> 대상 문서: Wordgard System Guide (Marijn Haverbeke)

## 배경

[Wordgard](https://wordgard.net)는 **ProseMirror·CodeMirror의 저자 Marijn Haverbeke**가 만든
차세대 리치텍스트 에디터입니다. 가이드 문서는 이 시스템이 ProseMirror의 교훈과
CodeMirror 6의 확장 아키텍처(facet·compartment·precedence)를 계승했음을 밝힙니다.

이 문서는 Wordgard를 **경쟁 제품이자 레퍼런스 아키텍처**로 놓고 sagak과 비교합니다.
핵심 결론부터: **Wordgard는 sagak의 `ROADMAP.md` Phase 8(블록 기반 에디터)이 지향하는
목적지를 이미 구현한 성숙한 청사진**입니다.

## 1. 한눈에 보기

| 축 | Wordgard | sagak (현재) |
|---|---|---|
| 지향 | 스키마 기반 **시맨틱** 에디터(헤더/리스트/강조) | **WYSIWYG**(bold/폰트/정렬) |
| 콘텐츠 모델 | 커스텀 **불변 트리**(value semantics, 구조 공유) | **HTML 문자열**(`innerHTML`) |
| 서식 적용 | 트랜잭션 → 새 문서 생성 | `document.execCommand`(deprecated) |
| 렌더링 | **자체 렌더러**(문서→DOM, rAF flush, 자체 커서) | contentEditable 브라우저 위임 |
| 상태 | 불변 `GardState`(doc+selection+config) | 가변, EventBus로 상태 전파 |
| 확장 | facet / state-field / extension 트리 + precedence | EventBus(before/on/after) + 플러그인 |
| UI 프레임워크 | framework-agnostic(자체 menuBar) | **React 우선**(컴포넌트+훅) |
| 계보 | ProseMirror + CodeMirror 6의 후속 | 독자적, 실용주의 |

## 2. 축별 비교

### 콘텐츠 모델 — 가장 큰 격차
- **Wordgard**: 불변 트리. `Plot`(내용 있음)/`Leaf`(줄바꿈·이미지·텍스트). 텍스트는 특수 leaf이며
  인접 동일-mark 텍스트는 자동 병합. **mark 구조가 평평하고 결정론적 순서(rank)** 를 가져
  문서에 **단일 정규 표현(canonical form)** 이 존재 → 비교·검증·diff가 쉬움. 부모 포인터 없음(구조 공유).
- **sagak**: HTML 문자열. 브라우저가 만드는 `<b>` vs `<strong>` vs `<span style>` 편차를 그대로 안음.
  정규형 없음 → diff/비교/검증 불가. (DOMPurify 살균 계층이 필요했던 근본 이유.)

### 변경(Changes) / 상태
- **Wordgard**: `ChangeSet`(불변, 위치 기반) → `apply` → 새 문서. **position mapping**(변경 후 위치 추적으로
  선택/데코레이션 유지), **transform**(두 변경의 상호 교차 변환 = OT 기초), **correction**(구조 자동 보정).
  `GardState`는 불변, `Transaction`은 changes+selection+annotation+effect를 정밀 기술.
- **sagak**: `HistoryManager`가 `innerHTML` **스냅샷** 저장/복원. 단순하고 동작하지만 위치 매핑·협업(OT/CRDT)·
  부분 변경 추적이 원천적으로 불가. 상태는 EventBus로 분산 전파.

### 선택(Selection)
- **Wordgard**: `anchor/head`, Text/Node 선택 + **커스텀 선택 타입**(예: 표 `CellSelection`),
  resolved position(`Pos`)으로 문맥 조회.
- **sagak**: `SelectionManager`가 네이티브 `Selection/Range`를 래핑(IME/CJK 가드 포함). 이미 Range 기반이라
  견고하나 "노드 선택"·커스텀 선택 개념은 없음.

### 스키마
- **Wordgard**: **1급 스키마**. plot/leaf/mark 타입 정의 + 관계(어떤 노드가 어디에, 어떤 mark가 어떤 tag에).
  허용하지 않은 구조는 문서에 못 들어옴. HTML shape로 직렬화/파싱 자동 유도, schema override로 관계 조정.
- **sagak**: 스키마 개념 없음(무엇이든 innerHTML로 유입 → 살균 필수).

### 확장 / 설정 — 설계 철학의 차이
- **Wordgard**: **facet**(여러 입력을 combine, 정적/동적, 시그널 기반 의존 추적), **state field**(reducer),
  **extension 트리 + precedence**, **compartment**(런타임 부분 재설정). CodeMirror 6 아키텍처 그대로.
  라이브러리 기능 대부분이 공개 API로 작성됨(dogfooding).
- **sagak**: `EventBus`(before/on/after 3단계 + 취소) + `PluginManager`. 훨씬 단순하고 이해하기 쉬움.
  precedence·동적 재설정·조합 가능한 상태 확장 같은 정교함은 없음.

### 렌더링 & 커맨드 — sagak 로드맵과 정확히 겹침
- **Wordgard**: 문서를 **자체 렌더**, rAF flush 배칭, **자체 커서 레이어**, plugin이 `scheduleDOMRead/Write`로
  레이아웃 스래싱 방지. 커맨드는 `(editor, param) → TransactionSpec | false` 함수이며 **precedence 기반
  핸들러 오버라이드** 가능. `beforeinput`을 커맨드로 매핑.
- **sagak**: contentEditable + `execCommand`. [`docs/execcommand-migration.md`](./execcommand-migration.md)의
  커맨드 추상화(P0)가 정확히 Wordgard Command 개념의 축소판이며, Wordgard가 그 종착점을 보여줌.

### 데코레이션 / 메뉴 / 스타일
- **Wordgard**: 데코레이션(문서 불변 유지한 채 렌더 장식: tag/point/range), 접근성 갖춘 framework-less
  menuBar(+커스텀 렌더 지원), CSS-in-JS(`&dark/&light`).
- **sagak**: 데코레이션 개념 없음(직접 DOM). 메뉴는 React 컴포넌트. 스타일은 일반 CSS.
  **React 통합은 sagak의 강점** — Wordgard는 framework-agnostic이라 React 바인딩은 사용자 몫.

## 3. sagak의 현 위치

sagak이 `ROADMAP.md`에 "장기 과제"로 적어둔 항목들이 Wordgard에는 이미 구현/기반이 있습니다:

| sagak Phase 8 항목 | Wordgard 대응 |
|---|---|
| 블록 데이터 모델 | `Plot`/`Leaf`/`Mark` 불변 트리 |
| 블록 렌더러 | Wordgard editor 컴포넌트(자체 렌더 + flush) |
| 블록 변환(p→h1) | `ChangeSet` + 스키마 |
| 협업(CRDT/OT) | `ChangeSet.transform`(OT 기초) + position mapping |
| 블록 히스토리 | state field 기반 history + 변경 매핑 |

즉 **Wordgard는 "sagak이 지향하는 미래"의 구체적 청사진**입니다.

## 4. sagak이 취할 수 있는 것 (실행 가능, 로드맵 연계)

Wordgard를 통째로 베끼는 대신, 점진적으로 차용할 아이디어를 고릅니다.

1. **커맨드 추상화(즉시)** — `execcommand-migration.md`의 P0. Wordgard의 `Command = (editor,param)→spec|false`
   + **precedence 핸들러 오버라이드**를 참고해 `runCommand`에 핸들러 계층을 두면 execCommand 탈피와 확장성을
   동시에 확보. (마이그레이션 문서에 반영됨.)

2. **정규형(canonical) 마크 정렬(중기)** — 블록 모델 없이도 도입 가능. 인라인 서식 자체 구현(마이그레이션 P2)에서
   **mark rank 순서를 결정론적으로** 강제하면 diff/테스트/살균이 쉬워짐. (마이그레이션 문서에 반영됨.)

3. **스키마 개념의 경량 도입(중기)** — 전면 스키마는 무겁지만, "허용 태그/속성 화이트리스트"를 **살균 계층과 통합**하면
   사실상 미니 스키마가 됨(현재 DOMPurify 설정이 그 씨앗).

4. **불변 상태 + 트랜잭션(장기, Phase 8 진입점)** — EventBus 가변 모델에서 `GardState`류 불변 상태 + 트랜잭션으로
   가는 것이 협업/히스토리/데코레이션의 전제. 큰 결정이므로 별도 설계 필요.

5. **차용하지 말 것** — facet/compartment 같은 CodeMirror식 정교함은 sagak 규모엔 과함. sagak의 **EventBus 단순성과
   React 우선 통합은 오히려 강점**이니 유지.

## 5. 결론

- **성숙도/설계**: Wordgard가 압도적. ProseMirror/CodeMirror 경험이 응축된 참조 아키텍처.
- **sagak의 포지션**: "가볍고 React-friendly한 WYSIWYG"로서 다른 시장. 정면 경쟁이 아니라 Wordgard를 **북극성**
  삼아 execCommand 탈피 → 정규형 마크 → (선택적으로) 불변 트리로 **단계적으로** 올라가면 됨.
- **가장 중요한 시사점**: execCommand 마이그레이션이 옳은 첫걸음이며, 그 설계에 Wordgard의 **커맨드-핸들러 precedence**와
  **정규형 마크 정렬**을 반영하면 로드맵이 한층 탄탄해짐.

## 참고

- CM6(Wordgard의 원류) 상태 계층의 상세 분석은 [`reference-codemirror-state.md`](./reference-codemirror-state.md) 참고 — 트랜잭션 개념이 PM에서 CM6로 역수입된 계보도 확인됨.

- Wordgard는 외부 상용/독립 프로젝트이며, 본 문서는 공개 가이드를 바탕으로 한 아키텍처 비교입니다.
- 코드/디자인 차용 시 라이선스 확인 필요.
