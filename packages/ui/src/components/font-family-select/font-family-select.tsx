import type { ComponentChildren } from 'preact'
import { useFontState, useLocalFonts } from '../../hooks'
import { ToolbarSelect } from '../toolbar-select/toolbar-select'
import type { ToolbarSelectOption } from '../toolbar-select/toolbar-select'
import { sameFontFamily } from './font-family-select.utils'
import {
  FALLBACK_FONTS as fallbackFonts,
  FIXED_WIDTH,
  LOAD_SYSTEM_FONTS_VALUE,
  SYSTEM_GROUP,
  FALLBACK_GROUP,
} from './font-family-select.shared'

export { LOAD_SYSTEM_FONTS_VALUE }

/**
 * 기본 목록 — **한글을 그릴 수 있는 것만** 둡니다.
 *
 * 예전에는 Helvetica·Arial·Georgia·Times·Courier·Verdana 여섯 개였습니다.
 * 그런데 폰트 파일을 열어 확인해 보면 **여섯 개 전부 U+AC00(가) 이 없습니다.**
 * 한국어로 쓰는 에디터에서 고를 수 없는 것만 늘어놓고 있었던 셈입니다.
 *
 * 그래서 이름 대신 **스택**으로 둡니다. 기계마다 있는 한국어 폰트가 다르므로
 * 이름 하나를 박으면 또 같은 문제가 됩니다 — 앞에서부터 있는 것이 잡힙니다.
 *
 * 이건 **되돌아갈 바닥**입니다. Local Font Access API 는 Chromium 데스크톱에만
 * 있고 권한도 필요해서, 없거나 거절당한 자리에서 폰트 메뉴가 비면 안 됩니다.
 * 그 자리에서도 최소한 고딕/명조는 고를 수 있어야 합니다.
 */

/** 각 옵션을 자기 폰트로 렌더해 미리보기가 되게 합니다 */
const fallback: ToolbarSelectOption[] = fallbackFonts.map((font) => ({
  ...font,
  fontFamily: font.value,
}))

/**
 * "불러오기" 를 옵션으로 두는 이유는 **툴바에 자리가 없기 때문**입니다.
 *
 * 지금 툴바에는 버튼이 64개 있고 폭 900px 이하에서 이미 줄이 넘어갑니다
 * (`docs/toolbar-options.md`). 65번째 버튼을 만드는 대신, 사용자가 폰트를
 * 고르러 이미 열어 본 자리에 둡니다.
 *
 * 값이 실제 폰트 이름과 겹치면 안 되므로 CSS 로 성립하지 않는 문자열을 씁니다.
 *
 * ## 보이지 않는 문자를 쓰면 안 됩니다 (여기서 한 번 틀렸습니다)
 *
 * 처음엔 앞에 공백을 두려 했는데 소스에 실제로 들어간 것은 **NUL 문자**였고,
 * 눈으로는 공백과 구별되지 않았습니다. 그 값은 어떤 옵션과도 안 맞아
 * `select.value` 가 `''` 이 되고, 빈 폰트 이름이 커맨드로 흘러갔습니다
 * ("Font family blocked: No font family provided"). 즉 **불러오기가 아예 동작하지
 * 않았습니다.**
 *
 * 그런데도 **테스트는 통과했습니다.** 테스트에도 같은 문자열을 따로 적어
 * 두었는데 양쪽 다 같은 방식으로 깨져 있어서 서로 맞아떨어졌기 때문입니다.
 * 그래서 지금은 이 상수를 export 해서 테스트가 **같은 것**을 보게 하고,
 * 눈에 보이는 ASCII 만 씁니다.
 */

/**
 * `<optgroup>` 이름.
 *
 * 섞어 두면 어느 것이 진짜 그 기계에 깔린 폰트이고 어느 것이 폴백 스택인지
 * 구분이 안 됩니다.
 */

/**
 * 폰트 메뉴의 고정 폭 — **이 기능을 쓰기 전의 폭 그대로**입니다.
 *
 * ## 왜 고정하는가 (재 봤습니다)
 *
 * `<select>` 의 폭은 **가장 긴 항목**이 정합니다. 시스템 폰트를 불러오면 항목이
 * 크게 늘고 그중에 `Apple SD Gothic Neo` 같은 긴 이름이 있습니다.
 *
 * | | 셀렉트 폭 |
 * | --- | --- |
 * | 이 기능 전 | **104px** |
 * | 불러오기 항목만 추가 | 141px |
 * | 시스템 폰트까지 | **231px** |
 *
 * 폭 700px 에서 재면 그 결과가 이렇습니다 — 104px 일 때는 툴바가 87px 로
 * 가만히 있는데, 141px 로만 넓어져도 자동 저장 표시가 `saved` 가 되는 순간
 * 줄이 하나 늘어 **91 → 116px**, 즉 글 쓰던 자리가 25px 내려갑니다.
 *
 * 지난번 자동 저장 표시와 같은 종류인데, 그때는 처음 뜰 때였고 이번엔 사용자가
 * 메뉴를 누른 직후입니다. 실제로 `auto-save-layout.browser.test.tsx` 의 폭
 * 700px 검사가 이 회귀를 잡았습니다.
 *
 * ## 왜 141 이 아니라 104 인가
 *
 * 처음엔 141 로 뒀습니다 — 그런데 그건 **제가 넣은 불러오기 항목이 이미 포함된**
 * 폭이었습니다. 자기가 만든 것을 기준으로 삼은 셈이라 회귀가 그대로 남았습니다.
 * 원본을 꺼내 다시 재서 104 를 얻었습니다.
 *
 * (그 뒤 툴바 글자 크기를 14 → 12px 로 줄여서 지금 자연 폭은 이보다 조금
 * 작습니다. 104 를 그대로 두는 이유는 이 값이 **넘지 않을 상한**이면 충분하고,
 * 숫자를 바꾸면 옆 컨트롤들의 줄바꿈 위치가 또 움직이기 때문입니다.)
 *
 * 104 로 두면 **이 기능을 안 쓰는 사람에게는 아무것도 안 바뀝니다.**
 *
 * 대신 닫힌 상태에서 긴 이름은 말줄임으로 잘립니다. 고른 폰트가 무엇인지는
 * 메뉴를 열면 보이므로 이쪽을 택했습니다.
 */

export function FontFamilySelect(): ComponentChildren {
  const { fontFamily, setFontFamily } = useFontState()
  const { status, families, load } = useLocalFonts()

  const systemOptions: ToolbarSelectOption[] = families.map((family) => ({
    label: family,
    /*
     * 따옴표 없는 이름 그대로 둡니다. 적용한 뒤 되읽으면 브라우저가
     * `"Liberation Sans"` 처럼 따옴표를 붙여 돌려주는데, `useFontState` 가
     * 따옴표를 벗겨 주므로 이 값과 맞아떨어집니다. 실측으로 확인했습니다.
     */
    value: family,
    fontFamily: family,
    group: SYSTEM_GROUP,
  }))

  const options: ToolbarSelectOption[] = [
    ...(systemOptions.length > 0
      ? fallback.map((option) => ({ ...option, group: FALLBACK_GROUP }))
      : fallback),
    ...systemOptions,
  ]

  /**
   * 불러오기 항목은 **아직 해 보지 않았을 때만** 보입니다.
   *
   * 한 번 해 본 뒤(`ready`)나 이 브라우저에 API 가 없을 때(`unsupported`)는
   * 눌러도 될 일이 없으므로 내놓지 않습니다 — 조르지 않는 쪽입니다.
   *
   * 거절당한 경우도 `ready` 로 들어옵니다. 거절은 예외가 아니라 **빈 목록**으로
   * 오기 때문이고, 그래서 `families` 가 비어 `System` 묶음 자체가 안 생깁니다.
   */
  if (status === 'idle' || status === 'loading') {
    options.push({
      label: status === 'loading' ? 'Loading fonts…' : 'System fonts…',
      value: LOAD_SYSTEM_FONTS_VALUE,
      group: systemOptions.length > 0 ? SYSTEM_GROUP : undefined,
    })
  }

  /*
   * 글자 그대로 비교하면 안 됩니다 — 브라우저가 값을 다시 직렬화하면서
   * 따옴표를 떼거나 붙입니다. `font-family-select.utils` 참고.
   *
   * 그리고 `<select>` 에 넣는 값은 **옵션에 있는 그 문자열**이어야 합니다.
   * 읽어온 값을 그대로 넣으면 같은 폰트인데도 아무 옵션과 안 맞아 첫 항목이
   * 선택된 것처럼 보입니다.
   */
  const matched = options.find((option) =>
    sameFontFamily(option.value, fontFamily)
  )
  const currentValue = matched ? matched.value : fallback[0].value

  const onSelect = (value: string): void => {
    /*
     * 여기가 사용자 제스처 안입니다 — `<select>` 의 change 시점에도 일시적
     * 활성화가 살아 있는 것을 실측했습니다. 첫 호출에는 그것이 필요합니다.
     */
    if (value === LOAD_SYSTEM_FONTS_VALUE) {
      load()
      return
    }
    setFontFamily(value)
  }

  return (
    <ToolbarSelect
      title="Font Family"
      options={options}
      value={currentValue}
      onSelect={onSelect}
      width={FIXED_WIDTH}
    />
  )
}
