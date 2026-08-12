import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mountEditor, settle, placeCaretInText } from './harness'
import type { MountedEditor } from './harness'

/**
 * 초안을 지우는 버튼이 **무엇을 지우는지 말로** 알려야 합니다.
 *
 * 동작은 처음부터 의도대로였습니다 — 저장소만 비우고 쓰던 글은 남깁니다.
 * 문제는 문구가 다른 모델에서 온 말이었다는 것입니다.
 *
 * | 초안의 정체 | 버리기 UI | 예 |
 * | --- | --- | --- |
 * | 초안이 **문서 자체** | 있음 — 진짜로 지웁니다 | Gmail |
 * | 초안은 문서의 **백업** | **없음** — 복원 쪽만 둡니다 | TinyMCE · WordPress · CKEditor 5 |
 *
 * sagak 은 아래쪽인데 위쪽의 말인 `Discard draft` 를 썼습니다. 그래서 눌러도
 * 글이 안 사라지니 아무 일도 안 일어난 것처럼 보였고, 실제로 "discard 가
 * 동작하지 않는다" 는 보고로 돌아왔습니다.
 *
 * 여기서 지키는 것은 **말과 피드백**입니다. 동작을 바꾸는 것은
 * `auto-save.browser.test.tsx` 가 반대편에서 잡습니다.
 */

const KEY = 'sagak-test-wording'
const ORIGINAL = '<p>원본</p>'
const DRAFT = '<p>초안입니다</p>'

const options = { storageKey: KEY, debounceMs: 10, intervalMs: 0 } as const

let ed: MountedEditor | null = null

beforeEach(() => {
  localStorage.removeItem(KEY)
})

afterEach(() => {
  ed?.unmount()
  ed = null
  localStorage.removeItem(KEY)
})

const button = (e: MountedEditor): HTMLButtonElement | null =>
  e.root.querySelector<HTMLButtonElement>('[data-scope="auto-save"] button')

const shownText = (e: MountedEditor): string => {
  const indicator = e.root.querySelector<HTMLElement>('[data-scope="auto-save"]')
  if (!indicator) return ''
  /* 자리를 재기 위한 겹침 층은 aria-hidden 입니다 — 실제로 보이는 것만 읽습니다 */
  const layers = [
    ...indicator.querySelectorAll<HTMLElement>('span > span'),
  ].filter((el) => !el.hasAttribute('aria-hidden'))
  return layers.map((el) => el.textContent ?? '').join(' ')
}

async function draft(e: MountedEditor): Promise<void> {
  placeCaretInText(e.editable, 1)
  e.editable.innerHTML = DRAFT
  e.editable.dispatchEvent(new InputEvent('input', { bubbles: true }))

  const deadline = performance.now() + 5000
  while (performance.now() < deadline) {
    await settle(1)
    if (localStorage.getItem(KEY) === DRAFT) return
  }
  throw new Error('초안이 저장되지 않았습니다')
}

describe('초안 지우기 — 말과 피드백', () => {
  it('무엇을 지우는지 버튼에 적혀 있습니다', async () => {
    ed = await mountEditor(ORIGINAL, { autoSave: options, showAutoSaveIndicator: true })
    await settle(5)
    await draft(ed)

    const label = button(ed)?.textContent ?? ''

    expect(label).toBe('Delete saved draft')
    /*
     * `Discard` 는 Gmail 쪽 말이라 "쓰던 글이 사라진다" 로 읽힙니다.
     * 여기서는 저장된 사본만 지우므로 그 말을 쓰면 안 됩니다.
     */
    expect(label.toLowerCase()).not.toContain('discard')
    expect(label.toLowerCase()).toContain('saved')
  })

  it('지운 뒤 빈 칸이 아니라 지웠다고 알려줍니다', async () => {
    ed = await mountEditor(ORIGINAL, { autoSave: options, showAutoSaveIndicator: true })
    await settle(5)
    await draft(ed)

    button(ed)!.click()
    await settle(5)

    expect(
      shownText(ed).trim(),
      '눌렀는데 표시가 빈 칸이 되면 아무 일도 안 일어난 것으로 보입니다'
    ).toBe('Draft deleted')
  })

  it('알려주면서도 쓰던 글은 건드리지 않습니다', async () => {
    ed = await mountEditor(ORIGINAL, { autoSave: options, showAutoSaveIndicator: true })
    await settle(5)
    await draft(ed)

    button(ed)!.click()
    await settle(5)

    expect(localStorage.getItem(KEY), '저장소는 비어야 합니다').toBeNull()
    expect(ed.editable.innerHTML, '쓰던 글은 그대로여야 합니다').toBe(DRAFT)
  })

  /**
   * 이어서 쓰면 곧바로 새 초안이 생깁니다. 그때까지 "지웠음" 이 남아 있으면
   * 거짓말이 됩니다.
   */
  it('다시 저장되기 시작하면 확인 문구가 비켜납니다', async () => {
    ed = await mountEditor(ORIGINAL, { autoSave: options, showAutoSaveIndicator: true })
    await settle(5)
    await draft(ed)

    button(ed)!.click()
    await settle(5)
    expect(shownText(ed).trim()).toBe('Draft deleted')

    placeCaretInText(ed.editable, 1)
    ed.editable.innerHTML = '<p>이어서 씁니다</p>'
    ed.editable.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await settle(10)

    expect(shownText(ed).trim()).not.toBe('Draft deleted')
  })
})
