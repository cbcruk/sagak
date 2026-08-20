import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { autoSave, createAutoSavePlugin } from '@/features/auto-save'
import type { AutoSaveState } from '@/features/auto-save'
import { mountPluginArea } from '../helpers/plugin-area'
import type { PluginArea } from '../helpers/plugin-area'

/**
 * 자동 저장 — **상태의 주인이 어디인가.**
 *
 * 예전에는 `timestamp` 를 `saved` 일 때만 실어 보냈고, 표시가 그것을 받아 제
 * 쪽에 쟁여 두고 다음 상태들에 걸쳐 유지했습니다. 지우기를 누르면 표시가 자기
 * 사본을 `null` 로 되돌렸고요 — 상태 하나를 두 곳에서 관리한 것입니다.
 *
 * `savedAt` 이 상태의 일부가 되면서 그 이중 관리가 없어집니다. 아래는 그
 * 상태가 실제로 언제 어떻게 움직이는지입니다 — 지금까지 코어 쪽에는 자동
 * 저장 검사가 아예 없었습니다.
 */
const KEY = 'sagak-core-autosave-test'

describe('자동 저장', () => {
  let ed: PluginArea

  beforeEach(() => {
    localStorage.removeItem(KEY)
    localStorage.removeItem(`${KEY}-timestamp`)
    ed = mountPluginArea('<p>처음</p>')
  })

  afterEach(() => {
    ed.destroy()
    localStorage.removeItem(KEY)
    localStorage.removeItem(`${KEY}-timestamp`)
  })

  const module = () => autoSave(ed.context)

  const state = (): AutoSaveState => {
    let seen!: AutoSaveState
    module().subscribe((next) => {
      seen = next
    })()

    return seen
  }

  /** 앱과 같되 테스트가 기다릴 수 있도록 디바운스만 줄입니다 */
  const start = (extra = {}) =>
    ed.pluginManager.register(
      createAutoSavePlugin({
        storageKey: KEY,
        debounceMs: 10,
        intervalMs: 0,
        ...extra,
      })
    )

  const saved = (): string | null => localStorage.getItem(KEY)

  const settle = (ms = 40): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms))

  it('구독하면 지금 값을 곧바로 줘야 함', () => {
    expect(state()).toEqual({ status: 'idle', savedAt: null })
  })

  it('글이 바뀌면 예약하고 저장해야 함', async () => {
    await start()

    ed.load('<p>고친 글</p>')
    expect(state().status).toBe('pending')

    await settle()

    expect(saved()).toContain('고친 글')
    expect(state().status).toBe('saved')
    expect(state().savedAt).toBeGreaterThan(0)
  })

  /**
   * **프로그램이 갈아 끼운 것은 사용자가 친 것이 아닙니다.**
   *
   * 문서를 열거나 초안을 되살리면 트랜잭션이 `null` 로 옵니다. 그것을 저장
   * 신호로 치면 열자마자 저장됩니다.
   */
  it('문서를 통째로 갈아 끼운 것은 저장 신호가 아니어야 함', async () => {
    await start()
    await settle()

    ed.area.setRawContent('<p>프로그램이 넣은 글</p>')
    await settle()

    expect(saved()).toBeNull()
    expect(state().status).toBe('idle')
  })

  /**
   * 마지막 저장 시각은 **다음 상태들에 걸쳐 유지됩니다.** 표시가 "Saved
   * at …" 을 계속 보여 줄 수 있어야 하기 때문입니다.
   */
  it('저장 시각은 그다음 상태에서도 남아야 함', async () => {
    await start()
    ed.load('<p>하나</p>')
    await settle()

    const at = state().savedAt
    expect(at).not.toBeNull()

    ed.load('<p>둘</p>')
    expect(state()).toMatchObject({ status: 'pending', savedAt: at })
  })

  describe('버리기', () => {
    it('저장소를 비우고 쓰던 글은 남겨야 함', async () => {
      await start()
      ed.load('<p>초안</p>')
      await settle()
      expect(saved()).toContain('초안')

      module().clear()

      expect(saved()).toBeNull()
      expect(state()).toEqual({ status: 'idle', savedAt: null })
      expect(ed.element.textContent).toBe('초안')
    })

    it('버린 뒤 이어서 쓰면 다시 저장돼야 함', async () => {
      await start()
      ed.load('<p>초안</p>')
      await settle()
      module().clear()

      ed.load('<p>초안 이어서</p>')
      await settle()

      expect(saved()).toContain('초안 이어서')
    })
  })

  describe('되살리기', () => {
    /**
     * 이 길은 예전에 `AUTO_SAVE_RESTORE` 이벤트였고 **아무도 안 불렀습니다.**
     * 이름으로 부를 수 있는 자리로 옮겼으니 여기서 동작을 못 박아 둡니다.
     */
    it('저장된 초안을 지금 글에 되살려야 함', async () => {
      localStorage.setItem(KEY, '<p>지난번에 쓰던 글</p>')
      await start()

      expect(await module().restore()).toBe(true)
      expect(ed.element.textContent).toBe('지난번에 쓰던 글')
    })

    it('저장된 것이 없으면 아무것도 안 해야 함', async () => {
      await start()

      expect(await module().restore()).toBe(false)
      expect(ed.element.textContent).toBe('처음')
    })

    it('되살린 것이 곧바로 다시 저장되지 않아야 함', async () => {
      localStorage.setItem(KEY, '<p>지난번에 쓰던 글</p>')
      await start()

      await module().restore()
      await settle()

      expect(state().status).toBe('idle')
    })
  })

  describe('직접 저장하는 경우', () => {
    it('onSave 를 주면 그쪽으로 가야 함', async () => {
      const seen: string[] = []

      await start({ onSave: (content: string) => void seen.push(content) })

      ed.load('<p>바깥으로</p>')
      await settle()

      expect(seen).toHaveLength(1)
      expect(seen[0]).toContain('바깥으로')
      expect(saved()).toBeNull()
    })

    it('저장이 실패하면 error 여야 함', async () => {
      await start({
        onSave: () => {
          throw new Error('서버가 거절했습니다')
        },
      })

      ed.load('<p>실패할 글</p>')
      await settle()

      expect(state().status).toBe('error')
      expect(state().error?.message).toBe('서버가 거절했습니다')
    })

    /**
     * `report` 는 **밖에서 저장하는 경우**를 위한 문입니다 — 이 저장소만 해도
     * 문서는 OPFS 로 따로 저장합니다. 예전에는 상태 이벤트를 직접 쏘면
     * 됐는데, 그것이 그 이벤트의 마지막 남은 값이었습니다.
     */
    it('report 로 표시에 상태를 알릴 수 있어야 함', () => {
      module().report('saving')
      expect(state()).toEqual({ status: 'saving', savedAt: null })

      module().report('saved', 1234)
      expect(state()).toEqual({ status: 'saved', savedAt: 1234 })

      module().report('pending')
      expect(state()).toEqual({ status: 'pending', savedAt: 1234 })
    })
  })

  it('같은 에디터에서는 같은 객체여야 함', () => {
    expect(autoSave(ed.context)).toBe(module())
  })
})
