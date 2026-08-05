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
- [x] **4. EventBus 제거(Lexical 노선) 재평가** — 완료 (§10). **결론: 제거하지 않습니다**

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

- ~~GitHub Pages가 무엇을 배포할지~~ → **앱으로 결정·적용** (§11)
- **`packages/ui`의 tsup 빌드를 유지할지.** 앱이 소스를 직접 참조하므로 지금은 쓰이지
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

~~`packages/react`가 여전히 `sagak-editor`라는 이름과 `packages/react` 경로를 씁니다.~~
→ **`packages/ui` / `sagak-ui`로 정정 완료** (§11)

---

## 10. 4단계 — EventBus 제거 재평가

### 결론: 제거하지 않습니다

앱으로 정의하면서 역할 ④(호스트 앱 확장점) 제약이 사라졌으니 제거가 싸질 것으로 봤는데,
다시 재보니 **제거의 이득이 이미 대부분 회수됐습니다.**

### 현재 실태 (A·B·C 이후)

| 항목 | 수치 |
| --- | --- |
| 참조 파일 | core 41 / react 21 |
| `emit` 호출 | 157 |
| `on` 구독 | 76 |
| 진짜 fan-out | `STYLE_CHANGED` 10곳, `CONTENT_RESTORED` 6곳 |

### 왜 이득이 줄었나

`event-bus-refactor.md`가 제거 근거로 든 것은 두 가지였습니다.

1. **타입 부재** — C단계가 해결했습니다. 페이로드가 컴파일 시점에 검사됩니다.
2. **이중 디스패치** — 여전히 남아 있지만, 아래 측정 결과 비용이 이득을 넘습니다.

즉 **제거로만 얻을 수 있는 것은 이제 이중 디스패치 해소뿐**입니다.

### 이중 디스패치를 걷어내는 비용 (실측)

`definePlugin` 기반 16개 중 **10개가 순수 통과**입니다 — `runCommand(x)` 호출과
`STYLE_CHANGED` 발행이 전부입니다.

```
bold, italic, underline, strike, subscript, superscript,
indent, outdent, paragraph, ordered-list
```

이들을 없애고 툴바가 `CommandRegistry`를 직접 호출하게 하면 플러그인 10개 + 이벤트 10종이
사라집니다. 하지만:

| 비용 | 실측 |
| --- | --- |
| 삭제될 테스트 | **약 100개** (bold 17, italic 17, underline 16, strike 16, …) |
| 성격 | 등록·명령 실행·`STYLE_CHANGED` 발행·**IME 차단** 검증 |

**IME 차단 테스트가 여기 섞여 있습니다.** A단계에서 가드를 중앙화했으므로 이 10개는 같은 코드를
10번 검증하는 셈이라 중복이긴 합니다. 하지만 **중복된 안전망을 100개 걷어내는 대가로 얻는 것이
"플러그인 파일 10개 감소"**라면 수지가 맞지 않습니다. 이중 디스패치는 지금까지 버그를 하나도
만들지 않았습니다.

### 부수 확인 — 페이로드를 읽는 구독자

`STYLE_CHANGED` 구독자 10곳 중 페이로드를 읽는 곳은 **find-replace 다이얼로그 하나**이고, 그마저
`style !== 'find'`면 무시합니다. 순수 통과 10개가 발행하는 `{ style: 'bold' }` 같은 값은 사실상
아무도 보지 않습니다. 나중에 이 층을 걷어낼 때 페이로드 호환을 걱정할 필요가 없다는 뜻이라
기록해 둡니다.

### 대신 한 것 — 타입 커버리지의 구멍 메우기

C단계에서 "**65종 전부** 등록"이라고 적었는데, 그건 `events.ts` 기준이었습니다. 실제로는
**플러그인이 자체 정의한 이벤트 10종이 맵 밖에 있어 `unknown`으로 남아 있었습니다.**

| 출처 | 이벤트 |
| --- | --- |
| `auto-save-plugin` | `AUTO_SAVE_STATUS_CHANGED`, `AUTO_SAVE_RESTORE`, `AUTO_SAVE_CLEAR` |
| `export-plugin` | `EXPORT_DOWNLOAD` |
| `image-resize-plugin` | `IMAGE_RESIZE_START`, `IMAGE_RESIZE_END` |
| `image-upload-plugin` | `IMAGE_UPLOAD_START`/`COMPLETE`/`ERROR`/`FROM_FILE` |

**이벤트 상수를 `events.ts`로 모으고** 맵에 등록했습니다. 상수를 옮긴 이유는 순환 의존
때문입니다 — 계산된 키는 값 참조가 필요해서 `import type`으로는 안 되고, `event-map`이
`plugins/`를 값으로 import하면 순환이 생깁니다.

**결과: 75종 / 75종.** 이제 "이벤트 상수는 `events.ts`에 있다"는 규칙에 예외가 없어서, 같은
구멍이 다시 생기지 않습니다.

페이로드 타입도 실제와 어긋난 것을 바로잡았습니다 — 처음 쓸 때 `savedAt`으로 적었으나 실제는
`timestamp`였고, `format`을 `string`으로 뒀으나 실제는 `'html' | 'markdown' | 'text'`
유니온이었습니다. 중복을 남기지 않으려고 `AutoSaveEventData`·`ExportDownloadData`·
`ExportFormat`·`AutoSaveStatus`의 **정의를 `event-map.ts`로 옮기고 플러그인이 재export**하도록
했습니다. 이벤트 계약의 단일 출처가 `event-map.ts`가 됩니다.

### 검증

typecheck 3패키지 통과 / lint 0 errors / build 통과 / **core 테스트 1009개 통과**.

타입이 실제로 무는지는 probe로 확인했습니다 — 잘못된 `status` 값, 페이로드 없는 이벤트에 전달,
필수 페이로드 누락이 모두 컴파일 오류가 되고 구독 핸들러의 페이로드 타입도 좁혀집니다.

### 언제 다시 볼 것인가

이중 디스패치 제거는 **테스트를 먼저 정리한 뒤**가 맞습니다. 순수 통과 10개의 테스트가
중복이라는 판단이 서면 그때 함께 걷어내면 비용이 맞아떨어집니다. 지금 순서로 하면 안전망을
먼저 버리는 셈이 됩니다.

---

## 11. 후속 — Pages 대상과 패키지 이름

### GitHub Pages → 앱

Storybook 대신 앱을 배포합니다.

> **갱신.** Storybook은 이후 제거했습니다 — 배경은
> [`kinu-evaluation.md`](./kinu-evaluation.md) §13 참고.
워크플로 파일도 `deploy-app.yml`로 바꿨습니다.

Pages는 프로젝트 사이트를 하위 경로(`/sagak/`)로 서빙하므로 앱에 base가 필요합니다.
`'/sagak/'`가 아니라 **`'./'`(상대 경로)**로 뒀습니다 — 빌드 산출물에 저장소 이름이 박히지 않고
어디에 올려도 동작합니다.

**잘못된 base는 빌드가 성공한 뒤 흰 화면이 되는 종류**라, `dist`를 `/sagak/` 하위 디렉터리에
복사해 headless Chromium으로 구동했습니다. 8개 검증 전부 통과 — 자산 해석, Preact VDOM 마커,
타이핑, Bold 적용.

**덤으로 favicon을 붙였습니다.** 이번 세션의 모든 브라우저 검증에서 404가 하나씩 찍혔는데,
응답을 가로채 보니 4xx가 하나도 없었습니다. 브라우저가 자동 요청하는 `favicon.ico`였고 서버
리스너에는 잡히지 않는 종류였습니다. 선언해두면 요청 자체가 사라지므로, **앞으로 진짜 404가
소음에 묻히지 않습니다.**

### `packages/react` → `packages/ui`, `sagak-editor` → `sagak-ui`

디렉터리는 React라고 하고 패키지는 editor라고 하는데 **둘 다 더는 사실이 아니었습니다.**
이제 `sagak-core` / `sagak-ui` / `sagak-app`으로 맞습니다.

**`apps/editor`로 병합하는 안(B)과 저울질했습니다.**

| | 파일 | 줄 |
| --- | --- | --- |
| `packages/core` | 74 | 14,501 |
| `packages/ui` | 50 | 5,478 |
| `apps/editor` | 2 | **66** |

앱이 66줄이니 오늘 기준으로 `ui`↔`app` 경계는 이름뿐이고, §4가 정당화한 것도 core↔뷰 경계이지
뷰↔앱 경계가 아닙니다. 그런데도 이름 정정만 한 이유는, **앱이 얇은 게 본질이 아니라 최소 셸로
방금 쓰였기 때문**입니다. 제품 방향이 정해져 라우팅·저장·설정이 붙으면 `packages/ui`는 진짜
경계가 됩니다.

즉 **확실히 틀린 것(이름)만 낮은 비용으로 고치고, 불확실한 것(구조)은 근거가 생길 때 판단**하는
쪽입니다. **B가 맞아지는 시점은 명확합니다** — 앱이 한동안 커졌는데도 `packages/ui`가 그 앱
하나에만 쓰이면, 그때가 경계가 값을 못 한다는 증거입니다.

**localStorage 키는 건드리지 않았습니다** — `sagak-editor-autosave`,
`sagak-editor-recent-*-colors`는 저장된 사용자 데이터라 이름을 바꾸면 기존 콘텐츠가 유실됩니다.

`repository.url`에 남아 있던 스캐폴드 플레이스홀더(`github.com/user/sagak-editor.git`)도 실제
값으로 채웠습니다.

