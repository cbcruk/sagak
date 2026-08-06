import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mountEditor, settle, type MountedEditor } from './harness'

/**
 * 자동 저장 — 저장과 복원이 **둘 다** 돌아야 뜻이 있습니다.
 *
 * 켜기 전까지 이 기능은 죽어 있었습니다. `createEditor` 의 `autoSave` 기본값이
 * `false` 라 플러그인이 등록된 적이 없는데도 `AutoSaveIndicator` 는 앱에
 * 붙어 있었습니다 (`event-contract.browser.test.tsx` 가 잡은 것).
 *
 * 저장만 켜면 글이 localStorage 로 들어가기만 하고 돌아올 길이 없으므로
 * 앱은 `restoreOnInit: true` 로 켰습니다. 그런데 그 복원은 플러그인 안에서
 * `setTimeout(…, 0)` 으로 `initialContent` 뒤에 끼워 넣는 구조입니다 —
 * 순서가 보장이 아니라 경합에 가깝습니다. 그래서 추론하지 않고 여기서
 * **실제로 다시 마운트해** 확인합니다.
 */

const KEY = 'sagak-test-autosave'

/** 앱과 같되, 테스트가 기다릴 수 있도록 디바운스만 줄입니다 */
const options = {
  storageKey: KEY,
  debounceMs: 20,
  intervalMs: 0,
  restoreOnInit: true,
} as const

const saved = (): string | null => localStorage.getItem(KEY)

/** 디바운스가 풀리고 저장이 끝날 때까지 */
async function flushSave(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 80))
  await settle(2)
}

describe('자동 저장', () => {
  let ed: MountedEditor | null = null

  beforeEach(() => {
    localStorage.removeItem(KEY)
    localStorage.removeItem(`${KEY}-timestamp`)
  })

  afterEach(() => {
    ed?.unmount()
    ed = null
    localStorage.removeItem(KEY)
    localStorage.removeItem(`${KEY}-timestamp`)
  })

  it('입력하면 저장되어야 함', async () => {
    ed = await mountEditor('<p>처음</p>', { autoSave: options })
    await settle(4)
    expect(saved()).toBeNull()

    const p = ed.editable.querySelector('p')!
    p.textContent = '고친 글'
    ed.editable.dispatchEvent(new Event('input', { bubbles: true }))
    await flushSave()

    expect(saved()).toContain('고친 글')
  })

  it('상태 표시가 저장 결과를 보여야 함', async () => {
    ed = await mountEditor('<p>처음</p>', { autoSave: options })
    await settle(4)

    const p = ed.editable.querySelector('p')!
    p.textContent = '표시 확인'
    ed.editable.dispatchEvent(new Event('input', { bubbles: true }))
    await flushSave()

    const indicator = ed.root.querySelector('[data-scope="auto-save"]')
    expect(indicator?.textContent).toMatch(/Saved/)
  })

  /**
   * 이 저장소에서 자동 저장이 죽어 있던 이유는 "켜지 않아서" 였지만, 켠 뒤에
   * 실제로 쓸모가 있는지는 이것 하나로 갈립니다.
   */
  it('다시 열면 쓰던 글이 살아나야 함 (initialContent 를 이겨야 함)', async () => {
    // Given: 한 번 쓰고 저장된 상태
    ed = await mountEditor('<p>처음</p>', { autoSave: options })
    await settle(4)
    const p = ed.editable.querySelector('p')!
    p.textContent = '쓰던 글'
    ed.editable.dispatchEvent(new Event('input', { bubbles: true }))
    await flushSave()
    expect(saved()).toContain('쓰던 글')

    ed.unmount()
    ed = null

    // When: 다른 initialContent 로 다시 연다
    ed = await mountEditor('<p>처음</p>', { autoSave: options })
    // restoreOnInit 은 setTimeout 으로 initialContent 뒤에 끼어듭니다
    await settle(6)

    // Then: initialContent 가 아니라 저장본이어야 합니다
    expect(ed.editable.textContent).toContain('쓰던 글')
    expect(ed.editable.textContent).not.toContain('처음')
  })

  it('저장된 것이 없으면 initialContent 가 그대로여야 함', async () => {
    ed = await mountEditor('<p>첫 방문</p>', { autoSave: options })
    await settle(6)

    expect(ed.editable.textContent).toContain('첫 방문')
  })

  it('지우면 저장소가 비어야 함', async () => {
    ed = await mountEditor('<p>처음</p>', { autoSave: options })
    await settle(4)

    const p = ed.editable.querySelector('p')!
    p.textContent = '지울 글'
    ed.editable.dispatchEvent(new Event('input', { bubbles: true }))
    await flushSave()
    expect(saved()).not.toBeNull()

    ed.context.eventBus.emit('AUTO_SAVE_CLEAR')
    await settle(2)

    expect(saved()).toBeNull()
  })
})
