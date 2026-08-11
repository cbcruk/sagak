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

  /**
   * `clear()` 는 훅에 있었지만 어디에도 노출되지 않았습니다 — 초안이 한 번
   * 저장되면 사용자가 지울 방법이 없었습니다. 인디케이터에 버튼을 붙였습니다.
   */
  it('저장된 초안이 있을 때만 버리기 버튼이 보여야 함', async () => {
    ed = await mountEditor('<p>처음</p>', { autoSave: options })
    await settle(4)

    const discard = (): HTMLButtonElement | null =>
      ed!.root.querySelector<HTMLButtonElement>(
        '[data-scope="auto-save"] button'
      )

    // 저장된 것이 없으면 인디케이터 자체가 없습니다
    expect(discard()).toBeNull()

    const p = ed.editable.querySelector('p')!
    p.textContent = '초안'
    ed.editable.dispatchEvent(new Event('input', { bubbles: true }))
    await flushSave()

    expect(discard()).not.toBeNull()
  })

  /**
   * 버튼의 의미가 **바뀌었습니다.**
   *
   * 예전에는 "글을 되돌린다" 가 아니라 "저장된 초안을 버린다" 로 못박아
   * 뒀습니다. 그런데 그 동작은 사용자에게 아무 일도 안 일어난 것으로 보였습니다
   * — 저장소만 비고 화면의 초안은 그대로 남아, 한 글자만 더 치면 같은 초안이
   * 다시 저장됐습니다.
   *
   * 이제 "Discard draft" 는 문서까지 초안 이전으로 되돌립니다. 잘못 눌러도
   * 되돌리기로 살아납니다.
   *
   * 자세한 것은 `auto-save-discard.browser.test.tsx` 에 있습니다. 여기서는
   * 자동 저장 흐름 안에서 저장소가 비는 것만 확인합니다.
   */
  it('버리기 버튼이 저장소를 비우고 문서를 되돌려야 함', async () => {
    ed = await mountEditor('<p>처음</p>', { autoSave: options })
    await settle(4)

    const p = ed.editable.querySelector('p')!
    p.textContent = '초안'
    ed.editable.dispatchEvent(new Event('input', { bubbles: true }))
    await flushSave()
    expect(saved()).toContain('초안')

    const discard = ed.root.querySelector<HTMLButtonElement>(
      '[data-scope="auto-save"] button'
    )!
    discard.click()
    await settle(4)

    // 저장소는 비고
    expect(saved()).toBeNull()
    // 문서도 초안 이전으로 돌아가며
    expect(ed.editable.textContent).toContain('처음')
    expect(ed.editable.textContent).not.toContain('초안')
    // 버튼도 사라집니다 (버릴 초안이 없으므로)
    expect(ed.root.querySelector('[data-scope="auto-save"] button')).toBeNull()
  })

  it('버린 뒤 이어서 쓰면 다시 저장되어야 함', async () => {
    ed = await mountEditor('<p>처음</p>', { autoSave: options })
    await settle(4)

    const p = ed.editable.querySelector('p')!
    p.textContent = '초안'
    ed.editable.dispatchEvent(new Event('input', { bubbles: true }))
    await flushSave()

    ed.context.eventBus.emit('AUTO_SAVE_CLEAR')
    await settle(4)
    expect(saved()).toBeNull()

    /*
     * 되돌린 뒤라 `p` 참조가 죽었습니다 — `innerHTML` 을 갈아끼웠으므로 노드가
     * 새것입니다. 다시 찾아야 합니다.
     */
    const revived = ed.editable.querySelector('p')!
    revived.textContent = '처음 이어서'
    ed.editable.dispatchEvent(new Event('input', { bubbles: true }))
    await flushSave()

    expect(saved()).toContain('처음 이어서')
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
