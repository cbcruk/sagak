# 툴바를 옵션으로 제어하기 — 설계 노트

> 상태: 제안(Draft) · 대상: `sagak-ui` (일부 `sagak-core` 읽기)
> 관련: [`app-or-library.md`](./app-or-library.md), [`event-bus-refactor.md`](./event-bus-refactor.md)

## 요약 (결론 먼저)

1. **툴바는 설정을 아예 안 봅니다.** 플러그인을 하나도 안 넣어도 버튼 **64개와
   셀렉트 5개**가 그대로 그려집니다. Bold 를 누르면 예외도 안 나고 아무 일도
   안 일어납니다 — 눌리는데 죽어 있는 컨트롤입니다.
2. **그래서 새 옵션을 먼저 만들 일이 아닙니다.** `plugins` ·
   `replaceDefaultPlugins` · `autoSave` 라는 옵션이 **이미 있고**, 툴바에만
   안 닿고 있습니다. 먼저 잇는 것이 순서입니다.
3. 잇기만 해도 기본 구성에서 값이 나옵니다. `autoSave` 는 기본값이 `false`
   인데도 자동 저장 표시가 툴바 자리를 차지하고, 폭 1200px 에서 **툴바 한 줄을
   통째로 더 씁니다(+25px)**.
4. 명시 옵션(`<Toolbar>` 프로퍼티)은 그 **다음**이고, **빼는 것만** 할 수 있어야
   합니다. 설치 안 된 기능을 옵션으로 켤 수 있으면 1번 문제가 그대로 돌아옵니다.
5. 게이트 후보 27개는 전부 실제 플러그인 이름인 것을 확인했습니다. **어려운
   부분은 게이트가 아니라 구분선과 MoreMenu 중복**입니다.

---

## 1. 측정 — 지금 툴바가 설정을 얼마나 보는가

`packages/ui` 브라우저 환경에서 잰 값입니다.

### 1.1 플러그인이 없어도 전부 그려집니다

`createEditor({ replaceDefaultPlugins: true, plugins: [] })` 로 띄우고
`<Toolbar />` 를 붙였습니다.

| 잰 것              | 값                          |
| ------------------ | --------------------------- |
| 버튼               | **64개**                    |
| 셀렉트             | **5개**                     |
| Bold 버튼          | 존재 · 28 × 26px · 눌립니다 |
| Bold 를 누른 결과  | 예외 없음 · 내용 그대로     |

컨트롤 69개 전부가 아무 데도 연결돼 있지 않습니다. 사용자에게는 **되는 것처럼
보이는데 안 되는** 상태이고, 이건 보기 문제가 아니라 맞고 틀림의 문제입니다.

### 1.2 안 켠 기능이 자리를 차지합니다

`autoSave` 의 기본값은 `false` 입니다. 그런데도 —

```
<div data-scope="auto-save" data-part="indicator" data-status="idle"
     style="… visibility: hidden;">
```

**129 × 23px** 로 자리는 그대로 있습니다. 지난 세션에서 레이아웃 시프트를
없애려고 "항상 렌더한다" 로 바꾼 결과인데, **기능이 설치되지도 않은 경우**는
그때 고려하지 않았습니다.

값을 실제로 치르는지 재 봤습니다. 툴바에서 표시를 떼었을 때와 비교합니다.

| 폭     | 툴바 높이     | 편집 영역 top | 차이     |
| ------ | ------------- | ------------- | -------- |
| 1200px | 74 → 49       | 75 → 50       | **−25px** |
| 900px  | 87 → 87       | 88 → 88       | 0        |
| 700px  | 87 → 87       | 88 → 88       | 0        |
| 500px  | 129 → 129     | 130 → 130     | 0        |
| 380px  | 157 → 157     | 158 → 158     | 0        |

**다섯 폭 중 하나에서만 값을 치릅니다.** 넓은 화면에서는 툴바가 한 줄에
들어가는데 표시(129px)가 안 들어가 줄이 하나 더 생깁니다. 좁은 화면에서는 이미
여러 줄이라 마지막 줄에 얹히고 공짜입니다.

과장하지 않고 적자면 — **안 쓰는 기능 하나가 넓은 화면에서 툴바 한 줄입니다.**
기능이 여럿이면 이 값이 쌓입니다.

### 1.3 반대 방향도 확인했습니다

`autoSave: false` → `pluginManager.has('utility:auto-save')` 가 `false`.
즉 **코어는 이미 정답을 알고 있습니다.** 툴바가 안 물어볼 뿐입니다.

---

## 2. 설계 — 두 층

```
보임 = 설치됨(feature)  &&  !명시적으로_숨김(feature)
        ─────────────       ─────────────────────
        바닥 (자동)          덮개 (선택)
```

### 2.1 바닥 — 설치 여부에서 끌어옵니다 (새 API 없음)

툴바 항목마다 "이게 없으면 죽는다" 는 플러그인을 하나 정하고,
`pluginManager.has()` 로 묻습니다.

```tsx
// 개념
<Gate requires="content:table">
  <TableDialog />
</Gate>
```

이러면 **이미 있는 옵션이 툴바를 제어하기 시작합니다.**

| 지금 쓰는 옵션                       | 잇고 나면 툴바에 생기는 일       |
| ------------------------------------ | -------------------------------- |
| `autoSave: false` (기본값)           | 자동 저장 표시가 안 나옵니다     |
| `replaceDefaultPlugins` + `plugins`  | 넣은 것만 나옵니다               |
| 플러그인 하나 빼기                   | 그 컨트롤만 사라집니다           |

### 2.2 덮개 — 명시 옵션은 **빼기만** 합니다

```tsx
<Toolbar exclude={['table', 'export']} />
```

`include` 나 `{ table: true }` 를 **일부러 안 둡니다.** 켤 수 있으면 "설치 안
된 기능을 툴바에 올린다" 가 가능해지고, 그건 §1.1 로 되돌아가는 길입니다.
덮개는 바닥보다 넓어질 수 없습니다.

이 규칙 하나가 이 설계에서 제일 중요한 부분입니다. 나머지는 배관입니다.

### 2.3 왜 `<Toolbar>` 프로퍼티이고 `createEditor` 옵션이 아닌가

`autoSave` 가 `createEditor` 에 있는 것과 갈립니다. 이유는 **두 옵션이 서로
다른 것을 정하기 때문**입니다.

| 옵션                | 정하는 것       | 있어야 할 곳 |
| ------------------- | --------------- | ------------ |
| `autoSave`          | 기능을 **설치** | core         |
| `exclude`           | 툴바에 **표시** | ui           |

코어가 툴바를 알면 안 됩니다 — 툴바 없이 `sagak-core` 만 쓰는 것이 가능해야
하니까요. 그리고 호출 지점은 어차피 같은 자리입니다:

```tsx
const { editor } = useEditor({ autoSave: true })   // 설치
…
<Toolbar exclude={['export']} />                    // 표시
```

---

## 3. 게이트 표 — 27개 전부 실제 이름인지 확인했습니다

기본 구성 + `autoSave: true` 로 띄우고 27개를 `has()` 로 물었습니다. **없는
것 0개.** `bold` + `italic` 두 개만 넣었을 때는 **27개 중 2개**만 열립니다.

| 툴바 항목                | 게이트 플러그인               |
| ------------------------ | ----------------------------- |
| HistoryButtons           | `editing:history`             |
| HeadingSelect            | `paragraph:heading`           |
| FormatToggles — 굵게     | `text-style:bold`             |
| FormatToggles — 기울임   | `text-style:italic`           |
| FormatToggles — 밑줄     | `text-style:underline`        |
| FormatToggles — 취소선   | `text-style:strike`           |
| FormatToggles — 아래첨자 | `text-style:subscript`        |
| FormatToggles — 위첨자   | `text-style:superscript`      |
| ColorPicker — 글자       | `text-style:text-color`       |
| ColorPicker — 배경       | `text-style:background-color` |
| FontFamilySelect         | `text-style:font-family`      |
| FontSizeSelect           | `text-style:font-size`        |
| LineHeightSelect         | `text-style:line-height`      |
| LetterSpacingSelect      | `text-style:letter-spacing`   |
| AlignmentButtons         | `paragraph:alignment`         |
| ListButtons — 번호       | `paragraph:ordered-list`      |
| ListButtons — 불릿       | `paragraph:unordered-list`    |
| IndentButtons — 들여쓰기 | `paragraph:indent`            |
| IndentButtons — 내어쓰기 | `paragraph:outdent`           |
| LinkDialog               | `content:link`                |
| ImageDialog              | `content:image`               |
| TableDialog              | `content:table`               |
| HorizontalRuleButton     | `content:horizontal-rule`     |
| SpecialCharacterDialog   | `content:special-character`   |
| FindReplaceDialog        | `utility:find-replace`        |
| ExportMenu               | `utility:export`              |
| AutoSaveIndicator        | `utility:auto-save`           |

### 3.1 대응은 한 방향입니다

플러그인 6개는 툴바 항목이 없습니다 — `paragraph:format`,
`utility:keyboard-shortcuts`, `utility:autocomplete`, `utility:table-resize`,
`utility:image-resize`, `utility:image-upload`.

**툴바 항목은 플러그인을 필요로 하지만, 플러그인은 툴바 항목을 필요로 하지
않습니다.** 이게 맞습니다 — 단축키나 표 크기 조절은 보일 데가 없는 기능입니다.
표가 비어 있는 게 아니라 원래 부분 대응입니다.

### 3.2 그룹은 하나로 못 묶습니다

`FormatToggles` 하나가 플러그인 6개를 씁니다. 6개 중 5개만 있으면
"FormatToggles 를 보여줄까 말까" 가 아니라 **버튼 5개만 보여야** 합니다. 그래서
게이트는 컴포넌트 단위가 아니라 **컨트롤 단위**입니다. ColorPicker(2),
ListButtons(2), IndentButtons(2) 도 같습니다.

### 3.3 실패한 플러그인은 이미 알아서 걸러집니다

일부러 던지는 플러그인을 넣어 봤습니다.

- `run()` 이 던집니다: `Failed to initialize plugin "broken:thing": 일부러 실패`
- `has('broken:thing')` → **`false`**

`PluginManager.register` 가 실패 시 맵에서 지우기 때문입니다. 게이트에 따로
쓸 게 없습니다.

(다만 **플러그인 하나가 실패하면 에디터 전체가 안 뜹니다.** 이건 이 설계의
범위 밖이고, 별건으로 적어 둡니다 — §6.)

---

## 4. 진짜 어려운 부분 — 게이트가 아닙니다

### 4.1 구분선이 남습니다

지금 구분선은 형제 `<div>` 로 하드코딩돼 있습니다.

```tsx
<HistoryButtons />
<div data-part="separator" />
<HeadingSelect />
```

CSS 는 `width: 1px; height: 24px; margin: 0 4px` — 좌우 여백까지 **9px** 이고,
`:first-child` 나 인접 처리가 **없습니다**. 그래서 그룹이 통째로 빠지면
구분선이 남아 툴바 맨 앞에 세로줄이 뜨거나 두 개가 붙습니다.

**게이트만 넣고 여기를 안 고치면 결과가 지금보다 지저분해집니다.** 구분선을
"그룹 사이" 로 바꾸는 것이 게이트와 같은 단계에 들어가야 합니다.

(768px 아래에서는 `display: none` 이라 안 보입니다. 넓은 화면 문제입니다.)

### 4.2 MoreMenu 가 중복입니다

`MoreMenu` 안에서 아래첨자 · 위첨자 · 수평선을 **또** 발행합니다. `subscript`
를 빼면 툴바에서는 사라지고 MoreMenu 에는 남습니다. 게이트를 MoreMenu 항목에도
똑같이 걸어야 옵션이 새지 않습니다.

버튼 64개라는 숫자에 이 중복이 섞여 있습니다.

---

## 5. 단계

각 단계는 따로 머지할 수 있고, 앞 단계 없이 뒷 단계를 하면 안 됩니다.

### A. 게이트를 읽는 통로 (ui)

- 게이트 표를 한 파일에 둡니다 (§3)
- `usePluginAvailable(name)` — `pluginManager.has()` 를 감싸는 훅
- **테스트**: 표의 모든 게이트가 기본 구성에서 실제 플러그인이다 (§3 을 자동으로)
- 이 단계에서는 툴바가 안 변합니다. 통로만 놓습니다.

### B. 구분선을 그룹 경계로 (ui)

- 하드코딩 형제 `<div>` → 그룹 단위 표현
- **테스트**: 그룹을 하나 지웠을 때 구분선이 안 남는다
- **대조군**: 그룹화를 되돌리면 이 테스트가 실패해야 합니다
- 화면은 그대로여야 합니다 — 지금 구성에서 구분선 개수·위치가 같은지 잽니다

### C. 게이트를 실제로 걸기 (ui)

- 컨트롤 단위로 `has()` 확인 (§3.2)
- MoreMenu 항목도 같이 (§4.2)
- **테스트**: `plugins: []` → 툴바 컨트롤 0개. `bold`+`italic` → 2개
- **테스트**: `autoSave: false` 에서 폭 1200px 툴바 높이 74 → 49
- **대조군**: 게이트를 상수 `true` 로 바꾸면 위 셋이 전부 실패해야 합니다

여기까지가 **새 API 없이** 끝나는 부분이고, §1 의 두 결함이 여기서 닫힙니다.

### D. 명시 옵션 (ui)

- `<Toolbar exclude={[…]} />`
- **테스트**: `exclude` 로 뺀 것이 안 보인다
- **테스트**: 설치 안 된 것을 `exclude` 에서 빼도(=허용해도) 안 보인다 — 덮개가
  바닥을 못 넘습니다 (§2.2). 이게 이 단계의 핵심 단언입니다
- 이름 짓기: 짧은 id(`'table'`)를 쓸지 플러그인 이름(`'content:table'`)을
  그대로 쓸지 — §7

### E. 문서

- `README` 에 표시/설치 두 축 정리

---

## 6. 이 설계가 안 하는 것

| 안 하는 것                | 이유                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| 순서 바꾸기 · 그룹 재배치 | 요청에 없고, 게이트와 독립입니다. 필요해지면 그때                  |
| 프리셋 (`minimal` 등)     | 어떤 조합이 쓸모 있는지 아직 모릅니다. 추측으로 API 를 늘리지 않음 |
| 런타임 플러그인 추가/제거 | `PluginManager` 가 등록/해제를 **발행하지 않습니다** (§7)          |
| 실패한 플러그인 격리      | 지금은 하나 실패 = 에디터 전체 실패. 별건                          |
| 접근성 검증               | 이 환경에 화면 낭독기가 없습니다. 지난 세션과 같은 한계            |

---

## 7. 열린 질문 — 답이 바뀌면 설계도 바뀝니다

1. **플러그인 이름을 공개 계약으로 삼아도 되나?**
   `'content:table'` 은 지금 사실상 내부 이름입니다. UI 가 의존하면 공개 API 가
   됩니다. 대안은 플러그인 메타데이터에 `feature` id 를 두는 것인데, 그러면
   어휘가 둘이 됩니다. **지금 판단**: 이름을 그대로 쓰되 게이트 표 한 곳에만
   두어, 나중에 바꾸려면 그 파일만 고치면 되게 합니다.

2. **`exclude` 의 어휘는 무엇인가?**
   짧은 id 는 쓰기 좋지만 표를 하나 더 만듭니다. 플러그인 이름은 길지만
   §3.2 의 컨트롤 단위(굵게 vs FormatToggles)와 이미 1:1 입니다. **지금
   기울기**: 플러그인 이름. 새 어휘를 안 만드는 쪽.

3. **플러그인 집합이 런타임에 바뀌면?**
   `PluginManager` 는 등록/해제 때 아무것도 발행하지 않습니다. 지금 모든 사용은
   `run()` 전에 정해지므로 **마운트 시점 고정**으로 충분합니다. 바뀌는 사용이
   생기면 그때 이벤트를 넣고 훅을 구독으로 바꿉니다 — **이게 다시 열 조건**입니다.

4. **`autoSave` 표시가 넓은 화면에서 한 줄을 쓰는 것 자체는?**
   §1.2 는 *안 켰을 때* 를 잽니다. 켰을 때 1200px 에서 줄이 하나 느는 것은
   그대로입니다. 지난 세션의 레이아웃 테스트는 "상태가 바뀌어도 안 흔들린다"
   만 보장하지 "줄을 안 늘린다" 는 보장하지 않습니다. 별건으로 남깁니다.

---

## 부록 — 측정을 다시 하려면

이 문서의 수치는 임시 테스트로 쟀고 커밋하지 않았습니다. 단계 A~C 에서 같은
측정이 **영구 테스트**가 됩니다. 그 전에 다시 확인하려면 `packages/ui/test/`
에 브라우저 테스트를 만들고 —

- `createEditor({ container, replaceDefaultPlugins: true, plugins: [] })` 뒤
  `<Toolbar />` 를 붙여 `button` / `select` 개수를 셉니다
- `mountEditor()` (autoSave 기본 = 꺼짐) 로 띄우고 `[data-part="trailing"]` 을
  `remove()` 한 앞뒤로 툴바 높이를 잽니다
- `editor.context.pluginManager!.has(name)` 로 게이트를 확인합니다

이 환경에서는 `CHROMIUM_PATH=/opt/pw-browsers/chromium` 이 필요합니다.
