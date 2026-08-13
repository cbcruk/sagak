import { describe, it, expect, afterEach, afterAll, beforeEach } from 'vitest'
import { render } from 'preact'
import type { ComponentChildren } from 'preact'
import { cdp } from '@vitest/browser/context'
import { useLocalFonts } from '../src/hooks'
import { mountEditor, placeCaretInText, selectAll, settle } from './harness'
import type { MountedEditor } from './harness'
import { LOAD_SYSTEM_FONTS_VALUE } from '../src/components/font-family-select/font-family-select.shared'
import { supportsKorean } from '../src/hooks/use-local-fonts.utils'

/**
 * 폰트 메뉴가 **그 기계에 진짜 있는 폰트**를 보여줍니다 (Local Font Access API).
 *
 * ## 왜 필요한가 — 예전 내장 목록은 한글을 못 그립니다
 *
 * 예전 내장 목록(Helvetica·Arial·Georgia·Times·Courier·Verdana)을 폰트 파일까지
 * 열어 확인하면 **여섯 개 전부 U+AC00(가) 이 없습니다.** 한국어로 쓰는
 * 에디터에서 고를 수 없는 것만 늘어놓고 있었습니다. 아래
 * `예전 내장 목록은 한글을 못 그립니다` 가 그것을 계속 지켜봅니다.
 *
 * ## 권한을 어떻게 주는가 (여기서 막혔던 부분)
 *
 * `Browser.grantPermissions` 도, `origin` 만 준 `Browser.setPermission` 도
 * **성공을 돌려주면서 상태는 `prompt` 그대로**였습니다. `browserContextId` 를
 * 실어야 실제로 걸립니다. 그 전까지는 헤드리스에서 호출이 권한 대화상자를
 * 기다리며 무한정 매달렸습니다.
 *
 * ## 거절은 예외가 아닙니다
 *
 * 권한을 `denied` 로 두고 불러도 **거부 예외가 아니라 빈 배열**이 옵니다.
 * 처음엔 예외로 알아채는 코드를 썼고 테스트도 통과했는데, 대조군에서 그
 * 분기를 망가뜨려도 6개가 전부 통과해서 **한 번도 안 지나간 길**이라는 것이
 * 드러났습니다. 그래서 아래 거절 테스트는 예외가 아니라 **화면에 실제로
 * 나타나는 것**을 봅니다.
 */

let ed: MountedEditor | null = null

/** `theme.browser.test.tsx` 와 같은 방식입니다 */
type Cdp = { send: (method: string, params?: unknown) => Promise<unknown> }

async function setPermission(setting: 'granted' | 'denied'): Promise<void> {
  const session = cdp() as unknown as Cdp

  /*
   * `browserContextId` 를 실어야 실제로 걸립니다 — 없으면 호출은 성공을
   * 돌려주는데 권한 상태는 `prompt` 그대로입니다.
   */
  const info = (await session.send('Target.getTargetInfo')) as {
    targetInfo?: { browserContextId?: string }
  }

  await session.send('Browser.setPermission', {
    permission: { name: 'local-fonts' },
    setting,
    browserContextId: info.targetInfo?.browserContextId,
  })

  /*
   * CDP 호출이 돌아왔다고 페이지가 이미 안다는 뜻이 아닙니다. 상태가 실제로
   * 바뀔 때까지 기다립니다.
   *
   * 예전에는 이걸 안 해도 지나갔습니다 — 훅이 컴포넌트마다 권한을 다시 물었기
   * 때문에 마운트 시점에 늦게 읽혀도 맞아떨어졌습니다. 목록을 모듈로 올리고
   * `change` 를 구독하게 되면서 이 경합이 드러났습니다.
   */
  for (let i = 0; i < 100; i += 1) {
    const state = (
      await navigator.permissions.query({ name: 'local-fonts' as PermissionName })
    ).state
    if (state === setting) return
    await settle(1)
  }
  throw new Error(`권한이 ${setting} 로 바뀌지 않았습니다`)
}

const select = (root: HTMLElement): HTMLSelectElement =>
  root.querySelector('select[title="Font Family"]') as HTMLSelectElement

const values = (root: HTMLElement): string[] =>
  [...select(root).options].map((option) => option.value)

/** `<optgroup>` 라벨 → 그 안의 옵션 값들 */
function groups(root: HTMLElement): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const group of select(root).querySelectorAll('optgroup')) {
    out[group.label] = [...group.querySelectorAll('option')].map((o) => o.value)
  }
  return out
}

/** 사용자가 옵션을 고르는 것과 같은 경로 */
async function choose(root: HTMLElement, value: string): Promise<void> {
  const el = select(root)
  el.value = value
  el.dispatchEvent(new Event('change', { bubbles: true }))
  await settle()
}

/** 목록이 실제로 채워질 때까지 기다립니다 */
/**
 * 첫 스캔은 폰트 파일을 전부 열어 봅니다 — 이 기계에서 family 256개에 5.5초
 * 였습니다. 프레임 수가 아니라 **시간**으로 기다립니다.
 */
async function waitForSystemFonts(root: HTMLElement): Promise<void> {
  const deadline = performance.now() + 30_000
  for (let i = 0; performance.now() < deadline; i += 1) {
    await settle(1)
    if (groups(root).Korean?.length) return
  }
  throw new Error('시스템 폰트가 나타나지 않았습니다')
}

beforeEach(async () => {
  await setPermission('denied')
})

afterEach(() => {
  ed?.unmount()
  ed = null
})

/*
 * 권한은 **브라우저 컨텍스트에 남아 다른 파일로 넘어갑니다.** 여기서 켜 둔 채
 * 끝내면 다른 파일이 마운트할 때 시스템 폰트를 불러오게 되어, 그 파일의 결과가
 * 이 파일의 실행 순서에 따라 달라집니다.
 *
 * `prompt` 로 되돌리지 않고 `denied` 로 두는 이유는, `prompt` 면 호출이 권한
 * 대화상자를 기다리며 매달리기 때문입니다.
 */
afterAll(async () => {
  await setPermission('denied')
})

describe('시스템 폰트 불러오기', () => {
  it('한글 능력으로 거릅니다 — 이름으로 거르지 않습니다', async () => {
    await setPermission('granted')
    const query = (
      window as unknown as {
        queryLocalFonts: () => Promise<
          Array<{ family: string; blob: () => Promise<Blob> }>
        >
      }
    ).queryLocalFonts

    /*
     * `font.blob` 만 떼어 두면 수신자를 잃어 `Illegal invocation` 이 납니다.
     * FontData 를 통째로 보관합니다.
     */
    const byFamily = new Map<string, { blob: () => Promise<Blob> }>()
    for (const font of await query()) {
      if (!byFamily.has(font.family)) byFamily.set(font.family, font)
    }

    /*
     * 이 기계에 실제로 있는 것만 봅니다 — 없는 폰트는 이 단언의 대상이
     * 아닙니다(못 그리는 게 아니라 아예 없는 것이니까요).
     */
    const legacy = ['Helvetica', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana']
    const checked: string[] = []
    for (const name of legacy) {
      const font = byFamily.get(name)
      if (!font) continue
      checked.push(name)
      expect(
        await supportsKorean(await font.blob()),
        `${name} 이 한글을 그릴 수 있다면 이 테스트의 전제가 바뀝니다`
      ).toBe(false)
    }

    /*
     * 옛 이름이 이 기계에 하나도 없을 수 있습니다 (이 컨테이너가 그렇습니다 —
     * Liberation·DejaVu 계열만 깔려 있습니다). 그때 그냥 통과시키면 **아무것도
     * 안 보고 초록**이 되므로, 원래 이 테스트가 지키려던 성질을 대신 봅니다.
     *
     * 지키려던 것은 "이름이 아니라 **실제 한글 능력**으로 거른다" 입니다. 그게
     * 성립하려면 판별기가 이 기계에서 실제로 **양쪽으로 갈라야** 합니다 — 늘
     * true 나 늘 false 를 돌려주면 거르기 자체가 무의미합니다.
     */
    let korean = 0
    let notKorean = 0
    for (const [, font] of byFamily) {
      if (korean > 0 && notKorean > 0) break
      if (await supportsKorean(await font.blob())) korean += 1
      else notKorean += 1
    }

    expect(korean, '이 기계에 한글 폰트가 하나도 없습니다').toBeGreaterThan(0)
    expect(
      notKorean,
      '판별기가 전부 한글이라고 합니다 — 그러면 거르는 의미가 없습니다'
    ).toBeGreaterThan(0)
    expect(checked.length + korean + notKorean).toBeGreaterThan(0)
  })

  it('고른 한국어 폰트는 실제로 한글을 그릴 수 있습니다', async () => {
    await setPermission('granted')
    ed = await mountEditor()
    await waitForSystemFonts(ed.root)

    const query = (
      window as unknown as {
        queryLocalFonts: () => Promise<
          Array<{ family: string; blob: () => Promise<Blob> }>
        >
      }
    ).queryLocalFonts
    /*
     * `font.blob` 만 떼어 두면 수신자를 잃어 `Illegal invocation` 이 납니다.
     * FontData 를 통째로 보관합니다.
     */
    const byFamily = new Map<string, { blob: () => Promise<Blob> }>()
    for (const font of await query()) {
      if (!byFamily.has(font.family)) byFamily.set(font.family, font)
    }

    const offered = groups(ed.root).Korean
    expect(offered.length).toBeGreaterThan(0)

    for (const family of offered) {
      const font = byFamily.get(family)
      expect(font, `${family} 를 내놨는데 설치 목록에 없습니다`).toBeDefined()
      expect(
        await supportsKorean(await font!.blob()),
        `${family} 를 한국어 목록에 내놨는데 한글을 못 그립니다`
      ).toBe(true)
    }
  }, 60000)

  it('허용하면 시스템 폰트가 메뉴에 들어옵니다', async () => {
    await setPermission('granted')
    ed = await mountEditor()
    await waitForSystemFonts(ed.root)

    expect(groups(ed.root).Korean.length).toBeGreaterThan(0)
    expect(groups(ed.root).Default?.[0], '폴백 스택이 사라졌습니다').toContain(
      'Apple SD Gothic Neo'
    )
  }, 60000)

  it('시스템 폰트를 고르면 글에 적용되고 메뉴가 그것을 가리킵니다', async () => {
    await setPermission('granted')
    ed = await mountEditor('<p>hello world</p>')
    await waitForSystemFonts(ed.root)

    const family = groups(ed.root).Korean[0]

    selectAll(ed.editable)
    await choose(ed.root, family)

    expect(ed.editable.innerHTML).toContain('font-family')

    placeCaretInText(ed.editable, 2)
    await settle()

    expect(
      select(ed.root).value,
      '적용은 됐는데 메뉴가 딴 것을 가리키면 반쪽입니다'
    ).toBe(family)
  }, 60000)

  it('거절하면 빈 묶음을 만들지 않고 조르지도 않습니다', async () => {
    ed = await mountEditor()
    await settle()

    /*
     * 먼저 **누를 것이 실제로 있는지** 확인합니다. 이 줄이 없어서 앞 판의
     * 테스트가 헛통과했습니다 — 항목의 값이 깨져 있어 고를 수 없었는데,
     * "없어졌다" 는 단언만 보고 통과로 읽었습니다.
     */
    expect(values(ed.root), '불러오기 항목이 처음부터 없습니다').toContain(
      LOAD_SYSTEM_FONTS_VALUE
    )
    const before = values(ed.root).length

    // 사용자가 눌러 보고, 거절당합니다
    await choose(ed.root, LOAD_SYSTEM_FONTS_VALUE)
    for (let i = 0; i < 60; i += 1) {
      await settle(1)
      if (!values(ed.root).includes(LOAD_SYSTEM_FONTS_VALUE)) break
    }

    // 다시 조르지 않습니다
    expect(values(ed.root)).not.toContain(LOAD_SYSTEM_FONTS_VALUE)

    /*
     * 빈 `Korean` 묶음을 만들면 안 됩니다 — 열었을 때 이름표만 있고 안이 빈
     * 칸은 "왜 비었지" 로 읽힙니다.
     */
    expect(groups(ed.root).Korean, '빈 Korean 묶음이 생겼습니다').toBeUndefined()
    expect(
      select(ed.root).querySelectorAll('optgroup').length,
      '보여줄 시스템 폰트가 없으면 묶음 자체가 없어야 합니다'
    ).toBe(0)

    // 내장 목록은 하나도 잃지 않았습니다
    expect(values(ed.root).some((v) => v.includes('Apple SD Gothic Neo'))).toBe(
      true
    )
    expect(values(ed.root).length).toBe(before - 1)
  })

  /*
   * 여기서는 불러오기 항목이 있는지를 전제하지 **않습니다.**
   *
   * 목록이 모듈 수준에 있어서 "한 번 해 봤다" 는 사실이 페이지 전체에 남습니다.
   * 앞 테스트가 이미 시도했다면 이 항목은 없는 것이 맞습니다 — 그게 조르지
   * 않는다는 뜻이니까요. 그 수명은 앞 테스트가 이미 확인합니다.
   *
   * 이 테스트의 주제는 그게 아니라 **시스템 폰트를 못 받아도 내장 목록은
   * 멀쩡한가** 입니다.
   */
  it('시스템 폰트를 못 받아도 내장 목록은 그대로 쓸 수 있습니다', async () => {
    ed = await mountEditor('<p>hello world</p>')
    await settle()
    expect(groups(ed.root).Korean, '거절했는데 한국어 묶음이 있습니다').toBeUndefined()

    selectAll(ed.editable)
    const serif = values(ed.root).find((v) => v.includes('AppleMyungjo'))!
    await choose(ed.root, serif)
    placeCaretInText(ed.editable, 2)
    await settle()

    expect(select(ed.root).value).toBe(serif)
  })

  /**
   * 실측: 권한이 `granted` 면 사용자 제스처 **없이도** 호출이 됩니다 (클릭하고
   * 6초 뒤 — 일시적 활성화가 만료된 뒤에도 성공). 그래서 한 번 허용한 사람이
   * 열 때마다 또 누를 이유가 없습니다.
   */
  it('한 번 허용했으면 다음부터는 누르지 않아도 들어옵니다', async () => {
    await setPermission('granted')
    ed = await mountEditor()
    await waitForSystemFonts(ed.root)

    expect(
      values(ed.root),
      '이미 허용됐는데도 불러오기 항목이 남아 있습니다'
    ).not.toContain(LOAD_SYSTEM_FONTS_VALUE)
  }, 60000)
})

/**
 * 목록은 **기계의 사실**이라 모듈 수준 시그널에 둡니다. 아래 셋은 그 선택이
 * 실제로 값을 내는 지점입니다 — `useState` + `useEffect` 판에는 셋 다
 * 없었습니다.
 */
describe('목록은 컴포넌트가 아니라 기계에 붙어 있습니다', () => {
  function Probe(): ComponentChildren {
    const { status, families } = useLocalFonts()
    return <span data-probe>{`${status}:${families.length}`}</span>
  }

  const texts = (root: HTMLElement): string[] =>
    [...root.querySelectorAll('[data-probe]')].map((el) => el.textContent ?? '')

  async function until(
    root: HTMLElement,
    predicate: (t: string[]) => boolean,
    message: string
  ): Promise<void> {
    // 첫 스캔은 폰트 파일을 다 엽니다 — 프레임이 아니라 시간으로 기다립니다
    const deadline = performance.now() + 30_000
    while (performance.now() < deadline) {
      await settle(1)
      if (predicate(texts(root))) return
    }
    throw new Error(`${message} (마지막: ${texts(root).join(' | ')})`)
  }

  let root: HTMLElement | null = null
  afterEach(() => {
    if (root) render(null, root)
    root?.remove()
    root = null
  })

  it('컴포넌트가 몇 개든 API 를 한 번만 부릅니다', async () => {
    await setPermission('granted')

    const real = (
      window as unknown as { queryLocalFonts: () => Promise<unknown[]> }
    ).queryLocalFonts
    let calls = 0
    ;(
      window as unknown as { queryLocalFonts: () => Promise<unknown[]> }
    ).queryLocalFonts = () => {
      calls += 1
      return real.call(window)
    }

    try {
      root = document.createElement('div')
      document.body.appendChild(root)
      render(
        <>
          <Probe />
          <Probe />
          <Probe />
        </>,
        root
      )
      await until(
        root,
        (t) => t.length === 3 && t.every((x) => x.startsWith('ready:')),
        '세 개가 모두 준비되지 않았습니다'
      )

      const [first] = texts(root)
      expect(texts(root), '같은 사실을 보는데 값이 다릅니다').toEqual([
        first,
        first,
        first,
      ])
      /*
       * `1` 이 아니라 `1 이하` 입니다 — 앞 테스트가 이미 받아 뒀으면 한 번도
       * 안 부르는 것이 맞습니다. 컴포넌트마다 자기 상태를 갖던 판에서는 여기가
       * 3 이었습니다.
       */
      expect(calls, '컴포넌트마다 따로 불렀습니다').toBeLessThanOrEqual(1)
    } finally {
      ;(
        window as unknown as { queryLocalFonts: () => Promise<unknown[]> }
      ).queryLocalFonts = real
    }
  }, 60000)

  it('허용으로 바뀌면 다시 띄우지 않아도 들어옵니다', async () => {
    root = document.createElement('div')
    document.body.appendChild(root)
    render(<Probe />, root)
    await until(root, (t) => t[0]?.endsWith(':0') ?? false, '빈 상태로 시작해야 합니다')

    // 화면은 그대로 두고 권한만 바꿉니다
    await setPermission('granted')

    await until(
      root,
      (t) => /^ready:[1-9]/.test(t[0] ?? ''),
      '허용했는데 목록이 안 들어왔습니다'
    )
  }, 60000)

  it('권한이 취소되면 들고 있던 목록을 버립니다', async () => {
    await setPermission('granted')
    root = document.createElement('div')
    document.body.appendChild(root)
    render(<Probe />, root)
    await until(root, (t) => /^ready:[1-9]/.test(t[0] ?? ''), '먼저 받아와야 합니다')

    await setPermission('denied')

    await until(
      root,
      (t) => t[0]?.endsWith(':0') ?? false,
      '취소됐는데 못 쓰는 목록을 계속 들고 있습니다'
    )
  }, 60000)
})
