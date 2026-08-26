# Vite 8 / TypeScript 7 — 하나는 넣고 하나는 문 앞에서 멈췄습니다

## 시작은 잘못 짚은 것이었습니다

SvelteKit 3 RC 공지를 보고 올리려 했는데, 이 저장소에는 SvelteKit 이 없습니다.
`@sveltejs/kit` 의존성도, 라우트도, `$lib`/`$app/*` import 도 없습니다.
`apps/editor` 는 `index.html` + `main.ts` + `App.svelte` 짜리 순수 Vite SPA 이고
Svelte 는 `@sveltejs/vite-plugin-svelte` 로만 씁니다. 마이그레이션 가이드 본문은
적용할 대상이 한 줄도 없었습니다.

건진 것은 그 가이드의 **의존성 기준선**입니다. 재 보니 이미 어긋나 있었습니다.

## 진짜 문제였던 것 — vite peer 불일치

```
@sveltejs/vite-plugin-svelte@7.3.0
  peer vite: ^8.0.0-beta.7 || ^8.0.0

설치돼 있던 것:
  root         vite ^7.2.4  → 7.2.6
  apps/editor  vite ^6.0.0  → 6.4.1
  packages/ui  vite ^6.0.0  → 6.4.1
```

peer 가 충족되지 않은 채로 돌고 있었고, 워크스페이스 안에 Vite 가 6 과 7 두 벌
있었습니다. 세 곳을 `^8.2.2` 로 통일해 해소했습니다.

빌드 1.46s → 205ms, 번들 392.46 → 379.73 kB. 검사 860 개 그대로 통과합니다.

## TypeScript 는 7 이 아니라 6 에 세웠습니다

`tsc` 자체는 7 에서 멀쩡히 통과합니다. 세 패키지 전부 Done 이고, 오는 길에
실제 breaking change 셋을 고쳤습니다. **이 셋은 6 에서도 그대로 유효합니다** —
7 로 갈 때 다시 할 일이 아닙니다.

| 무엇 | 어떻게 |
| --- | --- |
| `TS5102: 'baseUrl' has been removed` | tsconfig 4 곳에서 `baseUrl` 삭제. `paths` 가 이미 tsconfig 기준 상대경로라 뜻이 안 바뀝니다 |
| `TS2430 DirectoryWithEntries` | 7 의 `lib.dom.d.ts` 가 `entries()` 를 직접 선언합니다. 그걸 채우려고 뒀던 shim 이라 걷었습니다 |
| `TS2882` CSS 부수효과 import | `apps/editor/src/vite-env.d.ts` 신설. `*.css` 는 `vite/client` 가 선언하고, 확장자 없는 alias 인 `sagak-ui/styles` 만 따로 적었습니다 |

그런데 **검사 도구 둘이 7 을 하드 거부합니다.**

```
svelte-check 4.7.6      → TypeScript 7 support currently requires both
                          TypeScript 7 and TypeScript 6 installed...
typescript-eslint 8.68  → typescript-eslint does not support TS 7.0.
```

우회를 재 봤고, 둘 다 막혔습니다.

- `svelte-check` 의 게이트는 `bin/ts-version-check.js` 가 **인자 파싱 전에** 던집니다.
  안내에 나오는 `--tsgo` 로는 못 넘어갑니다. 안내대로 `typescript@~6` +
  `@typescript/native@npm:typescript@7` 을 깔면 되긴 하는데, 그러면 주 `typescript`
  가 어차피 6 입니다. (참고: 저 `@typescript/native` 는 npm alias 문법이라
  패키지가 실재하지 않아도 됩니다. 404 를 보고 막다른 길로 오해하기 쉽습니다.)
- `typescript-eslint` 는 최신 8.68.0 도 canary 도 peer 가 `<6.1.0` 입니다.
  지원하는 버전이 아직 없습니다.

CI 는 Typecheck 과 Lint 를 필수 단계로 돌립니다. 7 로 가면 타입 안전망 두 겹
— Svelte 템플릿 검사와 린트 전체 — 을 끄고 CI 를 빨간불로 두는 값을 치릅니다.
컴파일러가 된다는 것과 저장소가 굴러간다는 것은 다른 이야기였습니다.

그래서 `typescript` 는 `6.0.0-beta` 입니다. 세 게이트가 전부 초록입니다.

**범위가 아니라 정확히 고정한 이유:** 6 은 stable 이 없고 `6.0.0-beta` 뿐입니다.
그런데 `~6.0.0-beta` 로 적으면 semver 의 prerelease 비교가 ASCII 라 `dev` > `beta`
가 되어 `6.0.0-dev.*` nightly 까지 걸립니다. 범위를 열어 둘 자리가 아닙니다.

`@typescript-eslint/*` 는 8.48 → 8.68 로 올렸습니다. 8.48 의 peer 는 `<6.0.0`
이라 6 에서 경고가 납니다.

## 7 로 갈 조건

둘 다 풀리면 그때입니다. 위 표의 코드 수정은 이미 끝나 있으니, 그때 할 일은
`typescript` 를 올리고 이 문단을 지우는 것뿐입니다.

- `svelte-check` 가 TS 6 동반 설치 없이 7 을 받는 판
- `typescript-eslint` 가 TS 7 을 지원하는 판

## 남겨 둔 peer 경고 둘

고칠 수 있었지만 이번 범위가 아니라 적어만 둡니다.

- `@vitest/mocker@3.2.4` 가 vite `^5||^6||^7` 을 원합니다. vitest 3 이 vite 를
  직접 의존해서 자기 몫으로 7.2.6 을 따로 깝니다. 그래서 워크스페이스에 Vite 가
  아직 두 벌입니다 — 앱은 8, 검사는 7 로 돕니다. 검사는 860 개 다 통과합니다.
  없애려면 vitest 4 로 올려야 하고, 그건 별건입니다.
- `svelte-check@4.7.6` 이 typescript `^5.0.0 || ^6.0.0` 을 원하는데 `6.0.0-beta`
  는 여기 안 걸립니다. prerelease 는 같은 버전에 prerelease 가 적힌 범위에만
  걸리기 때문입니다. 표기상의 문제고 실제로는 돕니다 — svelte-check 자신의
  게이트는 major 가 7 미만이면 통과시킵니다.
