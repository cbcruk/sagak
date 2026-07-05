# 프로젝트 분석: 문제점과 개선점

> 분석일: 2026-07-05 · 대상: `sagak` (WYSIWYG 에디터 모노레포)

## 개요

- **sagak-core** (~11.3k LOC): 프레임워크 독립 코어 — `EventBus`(before/on/after) + `PluginManager` + `SelectionManager`, 33개 플러그인
- **sagak-editor** (~5.4k LOC): React/Preact UI 컴포넌트 + 훅
- 기반: `contentEditable` + `document.execCommand`
- 테스트: 856개 브라우저 테스트, 코어 커버리지 93%. JSDoc 문서화 우수.

전반적으로 아키텍처 분리와 테스트 커버리지가 견고합니다. 아래는 우선순위별 문제점과, 이번 브랜치에서 처리한 개선 사항입니다.

---

## 🔴 P0 — 메모리 릭 (이번 브랜치에서 수정 완료)

세 개가 맞물려 에디터를 반복 마운트/언마운트하면 릭이 무한정 증가하던 문제. 라이브러리 배포 코드라 치명적.

1. **`WysiwygArea.destroy()`가 리스너 미정리** — `document`의 `selectionchange` 리스너와 `ResizeObserver`가 해제되지 않아 detached DOM이 GC되지 않음.
   → 리스너/옵저버 참조를 보관하고 `destroy()`에서 해제하도록 수정.

2. **`EditorCore.destroy()`가 추적 리스너 미정리** — `setupFormattingStateTracking()`이 등록한 `document` 리스너 + 3개 `EventBus` 구독 + 대기 중인 `requestAnimationFrame`이 정리되지 않음. 또한 생성자·`run()`에서 두 번 호출되어 중복 등록됨.
   → cleanup 함수를 보관해 `destroy()`에서 호출하고, 재호출 시 이전 리스너를 먼저 정리(중복 방지). `destroy()`에서 `eventBus.clearAll()` 추가.

3. **`useEditor`가 언마운트 시 `destroy()` 미호출** — `useEffect` cleanup 부재. 공개 `Editor` 인터페이스에 `destroy()`가 없어 소비자가 정리할 방법 자체가 없었음.
   → `Editor` 인터페이스에 `destroy()` 추가(→ `core.destroy()`), `useEditor`에 cleanup 추가.

## 🟠 P1 — 도구 체계 (이번 브랜치에서 수정 완료)

4. **CI에 테스트·린트·타입체크 부재** — `.github/workflows/`에 Storybook 배포만 존재. 856개 테스트와 93% 커버리지가 있는데 PR/푸시 시 아무것도 검증하지 않았음.
   → `ci.yml` 추가: install → build → typecheck → lint → test. Storybook 배포의 pnpm 버전(9→10)도 lockfile에 맞춰 정렬.

5. **`pnpm lint`가 완전히 깨져 있었음** — `eslint.config.js`가 루트에 없는 `eslint-plugin-storybook`/`@eslint/js`/`globals`를 import하고, `parserOptions.project`를 루트 `tsconfig.json`(존재하지 않는 `src`/`test`)에 연결해 880개 파싱 오류 발생. `dist`도 미무시.
   → 누락 devDependency를 루트에 추가, 타입 인식 린트 불필요하므로 `project` 참조 제거, `dist`/설정 파일 ignore 추가, TS에서 오탐인 `no-undef` 비활성화(typescript-eslint 권장). 소스의 실제 오류(case 블록 선언, `Function` 타입, 빈 인터페이스)도 수정.
   → `typecheck` 스크립트(`tsc --noEmit`)를 각 패키지·루트에 추가.

---

## 🟢 P2 — HTML 살균 (이번 브랜치에서 수정 완료)

6. **붙여넣기/`setContent` 미살균 (보안, XSS)** — `paste`는 브라우저 기본 동작(임의 HTML 삽입)에 맡겨졌고 `setContent`는 `innerHTML`을 직접 설정해 스크립트 주입 위험이 있었음.
   → DOMPurify 기반 정화 계층 도입(`sanitizer.ts`). `WysiwygArea`가 `setContent`와 붙여넣기(`text/html`) 시 정화. 이미지 붙여넣기는 이미지 플러그인에, 순수 텍스트는 브라우저 기본 동작에 위임. 기본 활성화이며 `sanitize` 옵션(`createEditor`/`EditorCore`)으로 비활성화(`false`)하거나 사용자 정의 `DOMPurify` 설정을 전달 가능. 공개 API로 `createSanitizer`/`resolveSanitizer` export.

## 🟡 향후 개선 과제 (미착수 — 별도 논의 필요)

- **`execCommand` 전면 의존** — 브라우저에서 deprecated. 생성 마크업이 브라우저별로 달라 일관성/유지보수가 어려움. ROADMAP Phase 8(자체 렌더링 전환)에서 인지 중이나 근본 리스크.
- **프로덕션 소스의 `console.*` 147곳** — 배포 번들에 로그가 남음. 디버그 플래그/logger 추상화로 분리 권장.
- **에러 처리** — 다수 플러그인이 `catch` 후 `console.error`만 하고 삼킴. 사용자 피드백 경로 부재.
- **`no-explicit-any` 경고 62건** — 대부분 테스트/스토리 파일. 점진적 정리 권장.

---

## 이번 브랜치 변경 요약

| 영역 | 파일 |
| --- | --- |
| 릭 수정 | `packages/core/src/editor/editing-area/modes/wysiwyg-area.ts`, `packages/core/src/core/editor-core.ts`, `packages/core/src/create-editor.ts`, `packages/react/src/hooks/use-editor.ts` |
| HTML 살균 | `packages/core/src/editor/editing-area/sanitizer.ts`(신규), `wysiwyg-area.ts`, `editing-area-manager.ts`, `editor-core.ts`, `create-editor.ts`, `types.ts`, `index.ts` |
| 회귀/신규 테스트 | `packages/core/test/core/editor-core.browser.test.ts`(+2), `packages/core/test/editor/editing-area/sanitizer.browser.test.ts`(신규 +11), `wysiwyg-area.browser.test.ts`(+2) |
| CI/도구 | `.github/workflows/ci.yml`, `.github/workflows/deploy-storybook.yml`, `eslint.config.js`, `package.json`(root/core/react) |

검증: `pnpm build` ✅ · `pnpm typecheck` ✅ · `pnpm lint` ✅(0 errors) · 코어 871 테스트 ✅ · 리액트 4 테스트 ✅
