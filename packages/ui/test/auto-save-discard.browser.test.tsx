import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mountEditor, settle, placeCaretInText } from './harness'
import type { MountedEditor } from './harness'

/**
 * "Discard draft" 는 **초안을 버립니다.**
 *
 * 예전에는 `localStorage` 만 지우고 화면의 초안은 그대로 뒀습니다. 재 보면 —
 *
 * | Discard 클릭 후 | 예전 |
 * | --- | --- |
 * | 저장소 | 지워짐 |
 * | **편집 영역** | **초안 그대로** |
 * | 한 글자만 더 치면 | **초안이 다시 저장됨** |
 *
 * 버렸다고 눌렀는데 버려지지 않으니 사용자에게는 아무 일도 안 일어난 것으로
 * 보입니다.
 *
 * 되돌리는 쪽으로 고치면 잘못 눌렀을 때 글을 잃을 수 있습니다. 그래서 되돌리기로
 * 살릴 수 있어야 합니다 — 예전 복원 경로는 `innerHTML` 을 직접 갈아끼워
 * **히스토리에 안 들어갔고, 덮어쓴 직후 Undo 버튼이 비활성**이었습니다.
 */

const KEY = 'sagak-test-discard'
const ORIGINAL = '<p>원본</p>'
const DRAFT = '<p>초안입니다</p>'

const options = {
  storageKey: KEY,
  debounceMs: 10,
  intervalMs: 0,
} as const

let ed: MountedEditor | null = null

beforeEach(() => {
  localStorage.removeItem(KEY)
})

afterEach(() => {
  ed?.unmount()
  ed = null
  localStorage.removeItem(KEY)
})

const discardButton = (e: MountedEditor): HTMLButtonElement | null =>
  e.root.querySelector<HTMLButtonElement>('[data-scope="auto-save"] button')

/** 글을 고쳐 자동 저장을 유발하고, 저장될 때까지 기다립니다 */
async function draft(e: MountedEditor, html: string): Promise<void> {
  placeCaretInText(e.editable, 1)
  e.editable.innerHTML = html
  e.editable.dispatchEvent(new InputEvent('input', { bubbles: true }))

  const deadline = performance.now() + 5000
  while (performance.now() < deadline) {
    await settle(1)
    if (localStorage.getItem(KEY) === html) return
  }
  throw new Error(`초안이 저장되지 않았습니다 (${localStorage.getItem(KEY)})`)
}

async function mount(): Promise<MountedEditor> {
  const editor = await mountEditor(ORIGINAL, { autoSave: options })
  await settle(5)
  return editor
}

describe('초안 버리기', () => {
  it('저장소와 편집 영역을 함께 되돌립니다', async () => {
    ed = await mount()
    await draft(ed, DRAFT)

    expect(ed.editable.innerHTML).toBe(DRAFT)

    const button = discardButton(ed)
    expect(button, 'Discard 버튼이 없습니다').not.toBeNull()
    button!.click()
    await settle(10)

    expect(localStorage.getItem(KEY), '저장소가 안 지워졌습니다').toBeNull()
    expect(
      ed.editable.innerHTML,
      '저장소만 지우고 화면의 초안은 그대로 뒀습니다'
    ).toBe(ORIGINAL)
  })

  it('잘못 눌러도 되돌리기로 살아납니다', async () => {
    ed = await mount()
    await draft(ed, DRAFT)

    discardButton(ed)!.click()
    await settle(10)
    expect(ed.editable.innerHTML).toBe(ORIGINAL)

    const undo = ed.root.querySelector<HTMLButtonElement>(
      'button[title^="Undo"]'
    )!
    expect(undo.disabled, '되돌릴 수 없으면 잘못 누른 글이 사라집니다').toBe(
      false
    )

    undo.click()
    await settle(10)
    expect(ed.editable.innerHTML, '되돌렸는데 초안이 안 돌아왔습니다').toBe(
      DRAFT
    )
  })

  /**
   * 예전에는 버린 뒤에도 화면에 초안이 남아 있어서, 한 글자만 더 쳐도 그 초안이
   * 통째로 다시 저장됐습니다. 되돌려 두면 다시 저장되는 것은 **원본에 이어
   * 쓴 글**입니다.
   */
  it('버린 뒤 이어 쓰면 초안이 아니라 새 글이 저장됩니다', async () => {
    ed = await mount()
    await draft(ed, DRAFT)

    discardButton(ed)!.click()
    await settle(10)

    const continued = '<p>원본에 이어서</p>'
    await draft(ed, continued)

    expect(localStorage.getItem(KEY)).toBe(continued)
    expect(localStorage.getItem(KEY)).not.toBe(DRAFT)
  })

  it('버릴 초안이 없으면 문서를 건드리지 않습니다', async () => {
    ed = await mount()
    await settle(5)

    // 저장된 초안이 없으니 버튼도 없습니다
    expect(discardButton(ed)).toBeNull()
    expect(ed.editable.innerHTML).toBe(ORIGINAL)
  })
})
