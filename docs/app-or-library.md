# 앱인가 라이브러리인가 — 정체성 결정

> 상태: 결정됨 · 대상: 저장소 전체
> 관련: [`preact-migration.md`](./preact-migration.md), [`event-bus-refactor.md`](./event-bus-refactor.md)

## 결정

**sagak을 앱으로 정의합니다.** 라이브러리 배포를 전제한 제약을 걷어내고, 나중에 배포가 필요해지면
그때 다시 붙입니다.

단, **`packages/core`의 프레임워크 독립은 유지합니다** — 배포용이 아니라 **테스트 경계**로서입니다
(§4).

---

## 1. 근거 — 라이브러리 장비는 갖췄지만 하나도 작동하지 않는다

| 항목 | 상태 |
| --- | --- |
| npm 배포 | `sagak-core`·`sagak-editor` 둘 다 **E404** — 한 번도 배포된 적 없음 |
| `repository.url` | `https://github.com/user/sagak-editor.git` — **`user` 플레이스홀더 그대로** |
| `author` | **빈 문자열** |
| changesets | 설정은 있으나 **릴리스 대기 changeset 0건** |
| 소비자 | 저장소 안팎 통틀어 없음 |

반면 **앱으로서의 표면도 없습니다.**

- `index.html`이 저장소 어디에도 없음
- 두 패키지의 `dev` 스크립트가 전부 `tsup --watch` (라이브러리 워치 빌드)
- 에디터를 실제로 띄워볼 수 있는 **유일한 곳이 Storybook**이고, GitHub Pages로 배포되는 것도
  Storybook

즉 **"소비자를 위한 API"와 "직접 쓰는 제품" 어느 쪽으로도 완결되지 않은 상태**입니다.
84커밋 / 7개월 / 기여자 2명 규모에서 배포 절차(dual ESM+CJS, `.d.ts` 생성, `exports` 맵,
`peerDependencies`, changesets)를 전부 유지하는 것은 **비용만 내고 이득은 받지 않는 구조**입니다.

## 2. 실체 없는 제약이 실제로 작업을 막고 있었다

이 결정은 취향이 아니라, 두 건이 실제로 이것 때문에 멈춰 있었기 때문입니다.

**#9 (Preact 전환)** — [`preact-migration.md`](./preact-migration.md) §4의 A/B/C 선택지는
**"React 소비자를 계속 지원할 것인가"**를 묻습니다. 소비자가 없으므로 질문 자체가 성립하지
않습니다. Preact 전환은 그냥 내부 구현 선택이 되고, `preact/compat` 별칭 노출·번들 크기
(base-ui를 dist에 넣느냐)·`peerDependencies` 고민이 전부 사라집니다.

**EventBus 제거** — [`event-bus-refactor.md`](./event-bus-refactor.md) §3의 역할 ④(호스트 앱
확장점)는 외부 확장자를 전제합니다. 없으므로 `core.exec()`·`getEventBus()`를 공개 표면으로
지킬 이유가 없고, 보류했던 Lexical 노선(버스 제거)의 비용이 크게 떨어집니다.

## 3. 걷어내는 것

| 대상 | 이유 |
| --- | --- |
| dual 포맷 빌드 (`format: ['esm','cjs']`) | 소비자가 없으므로 CJS 불필요 |
| `.d.ts` 생성 (`dts: true`) | 외부에 노출할 타입이 없음. 워크스페이스 내부는 소스로 참조 |
| `exports` / `main` / `module` / `types` / `files` / `sideEffects` | 패키지 진입점 계약 |
| `peerDependencies` | 소비자가 설치할 것이 없음 |
| `prepublishOnly` | 배포하지 않음 |
| changesets (`.changeset/`, `changeset`/`version`/`release` 스크립트) | 릴리스하지 않음 |

## 4. 유지하는 것 — 그리고 그 이유

### `packages/core`의 프레임워크 독립

**배포용이 아니라 테스트 경계로서 유지합니다.**

지금까지의 작업(execCommand 탈피, `CommandRegistry`, stored marks, EventBus 정리)에서 **1009개
테스트가 브라우저에서 프레임워크 없이** 돌아간 것은 core가 뷰와 분리돼 있기 때문입니다. 이건
라이브러리라서 얻은 이득이 아니라 **경계를 그어서** 얻은 이득이고, 앱이 되어도 그대로
유효합니다.

따라서 앱이 된 뒤에도 다음은 지킵니다.

- core는 뷰 프레임워크를 import하지 않는다
- core의 테스트는 뷰 없이 실행된다

반대로, **배포를 전제로 한 제약은 풀립니다** — 예를 들어 core가 `@preact/signals-core`를
의존해도 됩니다. 프레임워크 독립은 "Preact를 몰라야 한다"가 아니라 "**렌더러**를 몰라야 한다"는
뜻입니다.

### 워크스페이스 2패키지 구조

`core` / `editor` 분리는 위 경계를 물리적으로 강제하는 장치이므로 유지합니다. 단일 패키지로
합치면 경계가 규율로만 남아 무너지기 쉽습니다.

## 5. "나중에 잘되면" — 추출 비용을 낮게 유지하는 규율

이 결정은 **되돌릴 수 있어야** 합니다. 배포가 필요해지면 §3을 다시 붙이면 되고, 그 비용은 지금
유지하는 비용보다 작습니다. 다만 그때 비싸지지 않도록 다음을 지킵니다.

1. **core → 뷰 방향 의존을 만들지 않는다.** 이 한 줄이 깨지면 추출 비용이 급등합니다.
   (앱이 되면 감시가 느슨해지기 쉬운 지점이라 §4의 규율과 겹쳐 적어둡니다.)
2. **core의 공개 표면을 `index.ts`로 계속 모은다.** 나중에 그 파일이 그대로 진입점이 됩니다.
3. **core 테스트를 뷰 없이 유지한다.** 추출 가능성의 실질적 증거는 "뷰 없이 테스트가 도는가"
   하나입니다.

즉 **버리는 것은 배포 절차이고, 유지하는 것은 분리 자체**입니다.

## 6. 진행 순서

- [x] **1. 배포 장비 제거** (§3) — 완료 (§8)
- [x] **2. 앱 진입점 추가** — 완료 (§8)
- [x] **3. Preact 전환** — 완료 (§9). #9는 이 커밋으로 대체되므로 닫아야 합니다
- [ ] **4. EventBus 제거(Lexical 노선) 재평가** — 공개 API 제약이 사라진 뒤

## 7. 이 결정이 무효화하는 기존 문서

- [`preact-migration.md`](./preact-migration.md) **§4 (소비자 대상 A/B/C)** — 질문이 성립하지
  않으므로 폐기. A안(React 지원 포기)이 자동으로 성립합니다.
- [`preact-migration.md`](./preact-migration.md) **§7의 패키징 판단** — base-ui를 `dist`에
  번들할지는 소비자가 있을 때의 문제입니다. 앱이면 번들러가 알아서 합니다.
- [`event-bus-refactor.md`](./event-bus-refactor.md) **§3 역할 ④** — 재평가 대상.

## 범위 밖

- 앱의 제품 방향(무엇을 하는 앱인가)은 이 노트의 주제가 아닙니다. 여기서는 **저장소를 어떤
  종류의 소프트웨어로 다룰지**만 정합니다.

---

## 8. 실행 기록 — 1·2단계

### 1. 배포 장비 제거

| 대상 | 처리 |
| --- | --- |
| `main`/`module`/`types`/`exports`/`files`/`sideEffects` | 두 패키지에서 제거 |
| `peerDependencies` (`sagak-editor`) | 제거 |
| `prepublishOnly` | 제거 |
| `private: true` | 두 패키지에 명시 |
| tsup `format` | `['esm','cjs']` → `['esm']` |
| tsup `dts` | 제거 |
| changesets | `.changeset/` 삭제, 루트 스크립트 3개 제거, `@changesets/cli` 제거 |

### 2. 앱 진입점 — `apps/editor`

워크스페이스에 `apps/*`를 추가하고 `sagak-app`을 만들었습니다.

```
apps/editor/
  index.html
  vite.config.ts     워크스페이스 패키지를 dist 가 아니라 소스로 alias
  src/{main,app}.tsx
  src/index.css
```

**패키지를 빌드 산출물이 아니라 소스로 참조합니다.** 앱이므로 `dist`를 거칠 이유가 없고, 수정이
즉시 반영됩니다. 이 선택 덕분에 §3에서 `exports`를 걷어내도 아무 문제가 없습니다 — 오히려
`exports`가 남아 있었다면 소스 참조와 충돌했을 것입니다.

루트 스크립트를 앱 기준으로 바꿨습니다.

| 스크립트 | 의미 |
| --- | --- |
| `dev` / `build` / `preview` | 앱 (`sagak-app`) |
| `build:packages` | 패키지 tsup 빌드 (필요할 때만) |

### 검증 — 빌드가 아니라 동작으로

빌드 성공은 동작이 아니므로 `dist`를 띄워 headless Chromium으로 구동했습니다.

| 검증 | 결과 |
| --- | --- |
| 앱 셸 렌더 / 에러 배너 없음 | PASS |
| 편집 영역 마운트 + 초기 콘텐츠 | PASS |
| **타이핑 반영** | PASS |
| 툴바 렌더 (4개) | PASS |
| **Bold 적용 → `<h1><strong>사각사각</strong></h1>`** | PASS |

첫 시도는 실패했습니다 — `AutoSaveIndicator`를 헤더(`EditorProvider` 바깥)에 뒀는데 이 컴포넌트가
컨텍스트를 요구해서 앱 전체가 마운트되지 않았습니다. 프로바이더 안으로 옮겨 해결했고, **빌드는
성공하는데 화면이 비는** 종류라 브라우저 구동 없이는 못 잡았을 문제입니다.

코어 테스트 1009개 통과 / typecheck 3패키지 전부 통과 / lint 0 errors.

### 후속으로 정할 것

- **GitHub Pages가 무엇을 배포할지.** 지금은 Storybook입니다. 앱으로 정의했으니 앱을 배포하는
  쪽이 자연스럽지만, Storybook을 개발 도구로 계속 둘지와 함께 판단할 문제라 손대지 않았습니다.
- **`packages/react`의 tsup 빌드를 유지할지.** 앱이 소스를 직접 참조하므로 지금은 쓰이지
  않습니다. `build:packages`로 남겨두었습니다.

---

## 9. 실행 기록 — 3단계 Preact 전환

### #9를 리베이스하지 않고 다시 적용한 이유

#9(`721c054`)와 현재 트리가 겹치는 파일이 4개인데, 그중 둘은 **앱 결정으로 이미 다르게
처리된 부분**입니다.

| 파일 | #9의 변경 | 지금 |
| --- | --- | --- |
| `packages/react/package.json` | `peerDependencies`를 `react` → `preact`로 | `peerDependencies` 자체가 없음 (§3) |
| `packages/react/tsup.config.ts` | base-ui를 `noExternal`로 번들 | 소비자가 없어 무의미 |
| `more-menu.tsx` | import 경로 치환 | #10에서 버그 수정 |
| `pnpm-lock.yaml` | — | — |

즉 리베이스하면 **이미 폐기된 결정을 놓고 충돌을 푸는** 작업이 됩니다. 게다가 `apps/editor`는
#9에 존재하지 않으므로 어차피 별도 작업이 필요합니다. #9에서 검증된 코드모드를 현재 트리에
다시 적용하는 편이 깨끗합니다.

**#9는 이 작업으로 대체되므로 닫아야 합니다.**

### 적용

| 대상 | 변경 |
| --- | --- |
| 소스 29파일 | `from 'react'` → `preact/compat` |
| 전역 `React.` 21파일 | `import type * as React from 'preact/compat'` |
| 아이콘 19파일 | `lucide-react` → `lucide-preact` |
| Storybook / vitest | `@storybook/preact-vite`, `@preact/preset-vite` |
| `apps/editor` | `render()` + `JSX.Element` — **compat 이 아니라 Preact 네이티브** |

앱 진입점만 네이티브인 이유는 새로 쓴 코드라 compat을 거칠 이유가 없어서입니다. 기존
`packages/react`는 base-ui가 어차피 compat을 끌어오므로 compat으로 통일했습니다.

### 기계적이지 않았던 부분 (#9와 동일)

React의 `SyntheticEvent`는 `e.target`을 요소 타입으로 좁히지만 Preact의 `TargetedEvent`는 DOM
스펙대로 `EventTarget | null`로 두고 요소 타입을 `currentTarget`에 둡니다. `e.target.value` 12곳을
`e.currentTarget`으로 옮겼습니다 — **타입이 정확해지는 수정**입니다.

JSX 속성 차이 둘: `suppressContentEditableWarning`(React 전용) 제거, `spellCheck` → `spellcheck`.

### 검증

| 관문 | 결과 |
| --- | --- |
| typecheck (3패키지) | 0 오류 |
| lint | 0 errors |
| 앱 빌드 / Storybook 빌드 | 통과 |
| core 테스트 | **1009개 통과** |
| editor 테스트 | **4개 통과** |
| **앱 브라우저 구동** | **8/8 통과** |

브라우저 구동에서 **Preact VDOM 마커(`__k`)를 실제 DOM 노드에서 확인**했습니다 — 번들에 React
내부 마커가 없다는 것과 합쳐, 렌더러가 실제로 Preact임을 두 층위에서 검증한 셈입니다. 타이핑,
툴바, Bold(`<h1><strong>사각사각</strong></h1>`)까지 동작합니다.

### 앱 번들

363 KB / **gzip 113.6 KB** (base-ui·lucide·에디터 전체 포함).

### 남은 것

`packages/react`가 여전히 `sagak-editor`라는 이름과 `packages/react` 경로를 씁니다. 이름은 이미
React를 가리키지 않고, 경로 변경은 `deploy-storybook.yml` 2곳을 함께 고쳐야 해서 이번 범위에서
제외했습니다.

