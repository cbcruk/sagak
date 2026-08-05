import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { cdp } from '@vitest/browser/context'
import {
  mountEditor,
  settle,
  click,
  button,
  dialog,
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

      it('다이얼로그가 테마를 따라야 함', async () => {
        ed = await mountEditor()
        await click(button(ed.root, 'Insert Table'))

        const dlg = dialog('Insert Table')
        const style = getComputedStyle(dlg)

        if (scheme === 'dark') {
          expect(luminance(style.backgroundColor)).toBeLessThan(60)
        } else {
          expect(luminance(style.backgroundColor)).toBeGreaterThan(200)
        }
        expect(
          contrast(style.backgroundColor, style.color)
        ).toBeGreaterThanOrEqual(4.5)

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
