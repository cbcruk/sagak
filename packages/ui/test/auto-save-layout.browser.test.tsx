import { describe, it, expect, afterEach } from 'vitest'
import { AutoSaveEvents } from 'sagak-core'
import { mountEditor, settle, type MountedEditor } from './harness'

/**
 * 자동 저장 표시가 **레이아웃을 밀지 않아야 합니다.**
 *
 * ## 재 본 것
 *
 * 처음 뜰 때 아래 편집 영역이 **23px 내려갔습니다** (top 158 → 181).
 * `status === 'idle' && !lastSaved` 일 때 `null` 을 돌려주다가 갑자기
 * 나타나기 때문입니다.
 *
 * 가로도 흔들렸습니다. 상태 문구가 42.3~93.0px 사이로 바뀌면서 그 옆의
 * "Discard draft" 버튼이 **x = 128.0 → 88.7 → 77.3 으로 최대 50.7px**
 * 좌우로 튀었습니다. 누르려다 놓칠 수 있는 종류입니다.
 *
 * ## 그래서 무엇을 고정하는가
 *
 * - **세로** — 상태와 무관하게 항상 같은 높이를 차지합니다. 보일 것이
 *   없으면 내용만 감추고 자리는 지킵니다
 * - **가로** — 문구 자리를 **가장 긴 문구에 맞춰** 잡습니다. 픽셀을
 *   손으로 적지 않고 모든 문구를 같은 칸에 겹쳐 놓아 브라우저가 재게
 *   합니다. 글꼴이 바뀌거나 번역돼도 따라갑니다
 */

let ed: MountedEditor | null = null

afterEach(() => {
  ed?.unmount()
  ed = null
})

const STATES = ['pending', 'saving', 'saved', 'error', 'idle'] as const

async function setStatus(
  bus: MountedEditor['context']['eventBus'],
  status: (typeof STATES)[number],
  timestamp?: number
): Promise<void> {
  bus.emit(AutoSaveEvents.AUTO_SAVE_STATUS_CHANGED, {
    status,
    timestamp,
  } as never)
  await settle()
}

describe('자동 저장 표시는 레이아웃을 밀지 않습니다', () => {
  it('상태가 바뀌어도 아래 편집 영역이 움직이지 않습니다', async () => {
    ed = await mountEditor(undefined, { autoSave: true })
    await settle()

    const area = ed.root.querySelector(
      '[data-scope="editing-area"]'
    ) as HTMLElement
    const top = (): number => area.getBoundingClientRect().top

    const initial = top()

    for (const status of STATES) {
      await setStatus(
        ed.context.eventBus,
        status,
        status === 'saved' ? Date.now() : undefined
      )
      expect(top(), `${status} 에서 아래 영역이 움직였습니다`).toBe(initial)
    }
  })

  it('상태가 바뀌어도 Discard 버튼이 좌우로 튀지 않습니다', async () => {
    ed = await mountEditor(undefined, { autoSave: true })
    await settle()

    // lastSaved 가 있어야 버튼이 나옵니다
    await setStatus(ed.context.eventBus, 'saved', Date.now())

    const button = (): HTMLElement =>
      ed!.root.querySelector('[data-scope="auto-save"] button') as HTMLElement

    const initial = button().getBoundingClientRect().left

    for (const status of STATES) {
      await setStatus(ed.context.eventBus, status)
      expect(
        button().getBoundingClientRect().left,
        `${status} 에서 버튼이 움직였습니다`
      ).toBe(initial)
    }
  })

  /**
   * 문구 자리를 처음엔 `'Saved at 00:00'` 이라고 **손으로 적었다가
   * 틀렸습니다.** 이 환경은 12시간제라 실제로는 `Saved at 05:49 AM` 이
   * 뜨고, 자리표시가 실제보다 좁아서 버튼이 그대로 튀었습니다.
   *
   * 그래서 오전·오후 양쪽으로 재 둡니다.
   */
  it('오전·오후 어느 쪽이어도 폭이 같습니다', async () => {
    ed = await mountEditor(undefined, { autoSave: true })
    await settle()

    const slot = (): number =>
      (
        ed!.root.querySelector('[data-scope="auto-save"] span') as HTMLElement
      ).getBoundingClientRect().width

    await setStatus(
      ed.context.eventBus,
      'saved',
      new Date(2000, 0, 1, 9, 5).getTime()
    )
    const morning = slot()

    await setStatus(
      ed.context.eventBus,
      'saved',
      new Date(2000, 0, 1, 22, 45).getTime()
    )

    expect(slot()).toBe(morning)
  })

  it('표시가 항상 자리를 차지합니다 — 처음부터', async () => {
    ed = await mountEditor(undefined, { autoSave: true })
    await settle()

    const indicator = ed.root.querySelector('[data-scope="auto-save"]')
    expect(indicator, 'idle 이어도 자리는 있어야 합니다').not.toBeNull()
    expect(
      (indicator as HTMLElement).getBoundingClientRect().height
    ).toBeGreaterThan(0)
  })

  /**
   * 표시는 **툴바 안**에 있습니다. 툴바가 이미 자기 높이를 갖고 있으므로
   * 새 줄을 안 쓰고, 그래서 처음 뜰 때의 23px 이 사라졌습니다.
   *
   * 대신 새 위험면이 생겼습니다 — 툴바는 `flex-wrap: wrap` 이라 폭에 따라
   * 줄이 늘어납니다. 표시가 줄바꿈을 하나 더 만들면 툴바 높이가 변하고,
   * 그건 예전보다 나쁩니다.
   *
   * 줄 수가 폭에 따라 달라지는 것은 괜찮습니다 — 글을 쓰는 도중에 폭이
   * 바뀌지는 않으니까요. 문제가 되는 것은 **같은 폭에서 저장 상태에 따라**
   * 달라지는 경우입니다. 그것만 막으면 됩니다.
   */
  describe('툴바 안에서도 상태에 따라 흔들리지 않습니다', () => {
    for (const width of [1200, 900, 700, 500, 380]) {
      it(`폭 ${width}px`, async () => {
        ed = await mountEditor(undefined, { autoSave: true })
        ed.root.style.width = `${width}px`
        await settle()

        const bar = ed.root.querySelector(
          '[data-scope="toolbar"]'
        ) as HTMLElement
        const area = ed.root.querySelector(
          '[data-scope="editing-area"]'
        ) as HTMLElement

        await setStatus(ed.context.eventBus, 'idle')
        const height = bar.getBoundingClientRect().height
        const top = area.getBoundingClientRect().top

        for (const status of STATES) {
          await setStatus(
            ed.context.eventBus,
            status,
            status === 'saved' ? Date.now() : undefined
          )
          expect(
            bar.getBoundingClientRect().height,
            `${status} 에서 툴바 높이가 변했습니다 (줄바꿈)`
          ).toBe(height)
          expect(
            area.getBoundingClientRect().top,
            `${status} 에서 아래 영역이 움직였습니다`
          ).toBe(top)
        }
      })
    }
  })
})
