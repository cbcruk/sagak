import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { cdp } from 'vitest/browser'
import {
  mountEditor,
  settle,
  click,
  button,
  dialog,
  isOpen,
  placeCaretInText,
  type MountedEditor,
} from './harness'

/**
 * `#15` 에서 브라우저를 직접 몰아 확인했던 것들입니다.
 *
 * kinu 는 `prefers-color-scheme` 에 반응해 `--k-*` 를 뒤집습니다. 자체 스타일은
 * 크롬(`--sagak-chrome-*`)만 그걸 따라가고, 편집 영역(`--sagak-paper-*`)은 두
 * 테마에서 밝게 유지합니다. 본문 글자색은 사용자가 지정할 수 있고 기본이
 * 검정이라, 배경만 뒤집으면 그 글자들이 사라지기 때문입니다.
 */

type Cdp = { send: (method: string, params?: unknown) => Promise<unknown> }

async function setColorScheme(value: 'light' | 'dark'): Promise<void> {
  await (cdp() as unknown as Cdp).send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value }],
  })
  await settle()
}

const rgb = (value: string): [number, number, number] => {
  const [r, g, b] = (value.match(/\d+/g) ?? ['0', '0', '0']).map(Number)
  return [r, g, b]
}

const luminance = (value: string): number => {
  const [r, g, b] = rgb(value)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const relative = (value: string): number => {
  const channels = rgb(value).map((n) => {
    const s = n / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [relative(a), relative(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * 투명한 배경은 실제로 보이는 조상의 색으로 해석합니다.
 * `#15` 를 쓸 때 이걸 빼먹어서, 투명을 검정으로 취급한 검사가 잘못된 대비값
 * 21:1 을 내며 **통과**했습니다. 정작 그 배경은 CSS 변수 자기참조로 깨져
 * 있었습니다.
 */
function visibleBackground(el: Element): string {
  let node: Element | null = el
  while (node) {
    const color = getComputedStyle(node).backgroundColor
    if (color && !/rgba\(0, 0, 0, 0\)|transparent/.test(color)) return color
    node = node.parentElement
  }
  return 'rgb(255, 255, 255)'
}

describe('테마', () => {
  let ed: MountedEditor | null = null

  beforeAll(() => setColorScheme('light'))
  afterAll(() => setColorScheme('light'))

  afterEach(() => {
    ed?.unmount()
    ed = null
  })

  it('토큰이 자기 자신을 참조하지 않아야 함', async () => {
    ed = await mountEditor()
    const style = getComputedStyle(document.documentElement)

    // 일괄 치환이 `:root` 안의 정의까지 바꿔 `--sagak-accent: var(--sagak-accent)`
    // 가 됐던 적이 있습니다. 그러면 변수는 빈 값이 되고 배경이 투명해집니다.
    for (const token of [
      '--sagak-accent',
      '--sagak-accent-fg',
      '--sagak-paper-bg',
      '--sagak-paper-fg',
      '--sagak-paper-border',
      '--sagak-chrome-bg',
      '--sagak-chrome-fg',
      '--sagak-chrome-border',
    ]) {
      expect(style.getPropertyValue(token).trim(), token).not.toBe('')
    }
  })

  for (const scheme of ['light', 'dark'] as const) {
    describe(scheme, () => {
      beforeAll(() => setColorScheme(scheme))

      it('종이는 두 테마에서 밝고 대비를 유지해야 함', async () => {
        ed = await mountEditor()
        // `contenteditable` 요소 자체는 투명합니다. 배경은 그 부모인
        // `[data-part='wysiwyg']` 이 칠합니다 — #15 에서 이 구분을 놓쳐
        // 존재하지 않는 `[data-part='root']` 에 배경을 걸었었습니다.
        const background = visibleBackground(ed.editable)

        expect(background).toBe('rgb(255, 255, 255)')
        expect(
          contrast(background, getComputedStyle(ed.editable).color)
        ).toBeGreaterThanOrEqual(4.5)
      })

      it('크롬은 테마를 따라가야 함', async () => {
        ed = await mountEditor()
        const toolbar = ed.root.querySelector('[data-scope="toolbar"]')!
        const iconButton = ed.root.querySelector('[data-part="icon-button"]')!

        const toolbarBg = getComputedStyle(toolbar).backgroundColor
        const buttonStyle = getComputedStyle(iconButton)

        if (scheme === 'dark') {
          expect(luminance(toolbarBg)).toBeLessThan(90)
          expect(luminance(buttonStyle.backgroundColor)).toBeLessThan(60)
        } else {
          expect(luminance(toolbarBg)).toBeGreaterThan(200)
          expect(luminance(buttonStyle.backgroundColor)).toBeGreaterThan(200)
        }

        // 아이콘만 들어 있으므로 WCAG 그래픽 기준 3:1 입니다 (텍스트는 4.5:1)
        expect(
          contrast(buttonStyle.backgroundColor, buttonStyle.color)
        ).toBeGreaterThanOrEqual(3)
      })

      it('아이콘 버튼과 셀렉트 배경이 어긋나지 않아야 함', async () => {
        // 이번 이슈의 핵심입니다. kinu 는 뒤집히는데 자체 인라인 스타일은
        // 흰색으로 남아 툴바 한 줄에 두 배경이 섞여 있었습니다.
        ed = await mountEditor()
        const iconButton = ed.root.querySelector('[data-part="icon-button"]')!
        const select = ed.root.querySelector('select[title="Font Family"]')!

        expect(getComputedStyle(iconButton).backgroundColor).toBe(
          getComputedStyle(select).backgroundColor
        )
      })

      it('활성 버튼이 강조색으로 칠해져야 함', async () => {
        ed = await mountEditor()
        placeCaretInText(ed.editable)
        await settle(4)

        const active = ed.root.querySelector(
          '[data-part="icon-button"][data-state="active"]'
        )
        expect(active, '활성 정렬 버튼이 없습니다').not.toBeNull()

        const background = visibleBackground(active!)
        expect(background).toBe('rgb(0, 122, 255)')
        expect(
          contrast(background, getComputedStyle(active!).color)
        ).toBeGreaterThanOrEqual(3)
      })

      /**
       * **다이얼로그 전부**를 봅니다 — 예전엔 표 하나만 봤습니다.
       *
       * 다이얼로그의 생김새는 `k="dialog-content"` 속성 하나에 달려 있는데
       * 이걸 빼먹기가 아주 쉽습니다. Preact 를 걷어내며 링크·이미지
       * 다이얼로그가 실제로 이 속성 없이 옮겨졌습니다.
       *
       * ## 대비만 봐서는 안 물립니다 — 재 보고 알았습니다
       *
       * 목록으로 돌리기만 하면 잡힐 줄 알았는데 아니었습니다. `k` 를 떼도
       * 대조군이 **그대로 통과**합니다. UA 기본 `<dialog>` 가 `color-scheme`
       * 을 따라가서, 다크에서 배경이 `rgb(18, 18, 18)` — 우리 것(`rgb(9, 14,
       * 27)`)만큼이나 어둡고 흰 글씨와 대비도 충분하기 때문입니다.
       *
       * 즉 **테마를 따르는지와 우리 표면을 입었는지는 다른 질문**입니다.
       * 둥근 모서리와 세로 배치가 UA 기본값과 갈라지는 지점이라 둘 다 봅니다.
       */
      const DIALOGS = [
        'Insert Table',
        'Insert Image',
        'Insert Link',
        'Insert Special Character',
        'Find & Replace',
      ]

      it.each(DIALOGS)('%s 다이얼로그가 테마를 따라야 함', async (name) => {
        ed = await mountEditor()
        await click(button(ed.root, name))

        /* 여는 버튼의 이름과 다이얼로그의 `aria-label` 이 같습니다 */
        const dlg = dialog(name)
        expect(isOpen(dlg), '다이얼로그가 안 열렸습니다').toBe(true)

        const style = getComputedStyle(dlg)

        if (scheme === 'dark') {
          expect(luminance(style.backgroundColor)).toBeLessThan(60)
        } else {
          expect(luminance(style.backgroundColor)).toBeGreaterThan(200)
        }
        expect(
          contrast(style.backgroundColor, style.color)
        ).toBeGreaterThanOrEqual(4.5)

        /* UA 기본 `<dialog>` 는 각진 모서리에 `display: block` 입니다 */
        expect(
          style.borderTopLeftRadius,
          '다이얼로그가 표면 스타일을 안 입었습니다'
        ).not.toBe('0px')
        expect(style.display).toBe('flex')

        dlg.close()
      })

      it('흰 종이 위 표 테두리가 보여야 함', async () => {
        // 표 테두리를 크롬 토큰에 물리면 다크에서 흰 종이에 흰 선이 됩니다
        ed = await mountEditor(
          '<table><tr><td>a</td><td>b</td></tr></table>'
        )
        const cell = ed.editable.querySelector('td')!
        const border = getComputedStyle(cell).borderTopColor

        expect(contrast('rgb(255, 255, 255)', border)).toBeGreaterThan(1.3)
      })
    })
  }
})
