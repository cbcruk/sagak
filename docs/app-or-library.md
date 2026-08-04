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

- [ ] **1. 배포 장비 제거** (§3) — 프레임워크와 무관하므로 먼저
- [ ] **2. 앱 진입점 추가** — 지금은 Storybook 말고 띄울 방법이 없습니다. **이게 "앱으로
      정의"의 실질**입니다
- [ ] **3. #9 재개** — A/B/C 결정 없이 Preact 전환만. `main`에서 리베이스 필요
      (`more-menu.tsx` 충돌 예상)
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
