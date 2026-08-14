import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createDocumentStore } from 'sagak-core'
import { mountEditor, settle, click, dialog, isOpen } from './harness'
import type { MountedEditor } from './harness'

/**
 * 문서 목록 — 열기 · 이름 바꾸기 · 지우기.
 *
 * 지우기는 되돌릴 수 없습니다. 되돌리기는 편집 내용을 위한 것이지 저장소를
 * 위한 것이 아닙니다. 그래서 **한 번 더 묻고**, 그 확인이 실제로 막는지를
 * 여기서 봅니다.
 */

let ed: MountedEditor | null = null

async function clearStorage(): Promise<void> {
  const dir = await navigator.storage.getDirectory()
  const names: string[] = []
  for await (const name of (
    dir as unknown as { keys(): AsyncIterable<string> }
  ).keys()) {
    names.push(name)
  }
  for (const name of names) {
    await dir.removeEntry(name, { recursive: true }).catch(() => {})
  }
}

beforeEach(clearStorage)

afterEach(async () => {
  ed?.unmount()
  ed = null
  vi.restoreAllMocks()
  await clearStorage()
})

const barPart = <T extends HTMLElement>(e: MountedEditor, name: string): T =>
  e.root.querySelector<T>(`[data-scope="document-bar"] [data-part="${name}"]`)!

const answerName = (value: string | null): void => {
  vi.spyOn(window, 'prompt').mockReturnValue(value)
}

async function mount(): Promise<MountedEditor> {
  const editor = await mountEditor('<p>처음</p>', { showDocumentBar: true })
  await settle(5)
  // 앞 테스트의 문서 이름이 모듈에 남아 있으므로 새 문서로 시작합니다
  await click(
    editor.root.querySelector<HTMLElement>(
      '[data-scope="document-bar"] [data-part="new"]'
    )!
  )
  await settle(5)
  return editor
}

async function saveAs(e: MountedEditor, name: string): Promise<void> {
  answerName(name)
  await click(barPart(e, 'save-as'))
  await settle(5)
}

async function openDocuments(e: MountedEditor): Promise<HTMLDialogElement> {
  await click(barPart(e, 'documents'))
  await settle(4)
  const dlg = dialog('Documents')
  /*
   * **열렸는지**까지 봅니다. `dialog()` 는 이름으로 요소를 찾을 뿐이라 안
   * 열려도 내용은 읽힙니다 — `showModal()` 을 지워도 이 파일 11개와 문서 줄
   * 9개가 전부 통과했습니다. 링크·이미지 다이얼로그에서 이미 한 번 겪은
   * 구멍입니다.
   */
  expect(isOpen(dlg), '문서 목록이 안 열렸습니다').toBe(true)
  return dlg
}

const rowNames = (dlg: HTMLDialogElement): string[] =>
  [...dlg.querySelectorAll<HTMLElement>('[data-part="row"]')].map(
    (row) => row.dataset.name ?? ''
  )

const rowButton = (
  dlg: HTMLDialogElement,
  name: string,
  part: string
): HTMLButtonElement | null =>
  dlg.querySelector<HTMLButtonElement>(
    `[data-part="row"][data-name="${name}"] [data-part="${part}"]`
  )

describe('문서 목록', () => {
  /**
   * 이 앱에서 저장한 적이 없어도 **저장소에 있으면 보여야** 합니다 — 어제
   * 쓰고 오늘 다시 연 경우가 그렇습니다. 목록은 열 때 읽어 옵니다.
   */
  it('이 세션에서 저장한 적 없어도 저장소의 문서를 보여줍니다', async () => {
    await createDocumentStore().write('어제쓴글.html', '<p>어제</p>')

    ed = await mount()
    const dlg = await openDocuments(ed)

    expect(rowNames(dlg)).toContain('어제쓴글.html')
  })

  it('저장한 것이 없으면 비어 있다고 말합니다', async () => {
    ed = await mount()

    const dlg = await openDocuments(ed)

    expect(dlg.querySelector('[data-part="empty"]')).not.toBeNull()
    expect(rowNames(dlg)).toEqual([])
  })

  it('최근에 고친 것이 앞입니다', async () => {
    ed = await mount()
    await saveAs(ed, '첫째.html')
    await new Promise((resolve) => setTimeout(resolve, 20))
    await click(barPart(ed, 'new'))
    await settle(3)
    await saveAs(ed, '둘째.html')

    const dlg = await openDocuments(ed)

    expect(rowNames(dlg)).toEqual(['둘째.html', '첫째.html'])
  })

  it('열어 둔 문서를 표시합니다', async () => {
    ed = await mount()
    await saveAs(ed, '지금.html')

    const dlg = await openDocuments(ed)

    expect(
      rowButton(dlg, '지금.html', 'open')?.getAttribute('aria-current')
    ).toBe('true')
  })

  it('이름을 바꾸면 목록에서도 바뀝니다', async () => {
    ed = await mount()
    await saveAs(ed, '예전.html')

    const dlg = await openDocuments(ed)
    answerName('새이름.html')
    await click(rowButton(dlg, '예전.html', 'rename')!)
    await settle(5)

    expect(rowNames(dlg)).toEqual(['새이름.html'])
  })

  /**
   * 목록에서 바꾸는 것은 **그 줄의 문서**입니다. 열어 둔 문서를 바꾸면 안
   * 됩니다 — 둘이 다를 때 드러납니다.
   */
  it('열어 두지 않은 문서의 이름을 바꿉니다', async () => {
    ed = await mount()
    await saveAs(ed, '다른.html')
    await click(barPart(ed, 'new'))
    await settle(3)
    await saveAs(ed, '지금.html')

    const dlg = await openDocuments(ed)
    answerName('바뀐.html')
    await click(rowButton(dlg, '다른.html', 'rename')!)
    await settle(5)

    expect(rowNames(dlg).sort()).toEqual(['바뀐.html', '지금.html'])
  })

  it('이름 바꾸기를 취소하면 그대로입니다', async () => {
    ed = await mount()
    await saveAs(ed, '그대로.html')

    const dlg = await openDocuments(ed)
    answerName(null)
    await click(rowButton(dlg, '그대로.html', 'rename')!)
    await settle(5)

    expect(rowNames(dlg)).toEqual(['그대로.html'])
  })

  describe('지우기', () => {
    /**
     * 한 번 눌러서 지워지면 안 됩니다 — 되돌릴 방법이 없습니다.
     */
    it('한 번 누르면 아직 안 지워지고 확인을 묻습니다', async () => {
      ed = await mount()
      await saveAs(ed, '버릴것.html')

      const dlg = await openDocuments(ed)
      await click(rowButton(dlg, '버릴것.html', 'delete')!)
      await settle(4)

      expect(rowNames(dlg), '한 번 눌렀는데 지워졌습니다').toEqual([
        '버릴것.html',
      ])
      expect(rowButton(dlg, '버릴것.html', 'confirm-delete')).not.toBeNull()
    })

    it('한 번 더 누르면 지워집니다', async () => {
      ed = await mount()
      await saveAs(ed, '버릴것.html')

      const dlg = await openDocuments(ed)
      await click(rowButton(dlg, '버릴것.html', 'delete')!)
      await settle(4)
      await click(rowButton(dlg, '버릴것.html', 'confirm-delete')!)
      await settle(5)

      expect(rowNames(dlg)).toEqual([])
    })

    /**
     * 지운 것은 저장소에서 사라진 문서이지 화면의 글이 아닙니다.
     */
    it('열어 둔 문서를 지워도 쓰던 글은 남습니다', async () => {
      ed = await mount()
      ed.editable.innerHTML = '<p>화면에 남아야 합니다</p>'
      ed.editable.dispatchEvent(new InputEvent('input', { bubbles: true }))
      await settle(5)
      await saveAs(ed, '메모.html')

      const dlg = await openDocuments(ed)
      await click(rowButton(dlg, '메모.html', 'delete')!)
      await settle(4)
      await click(rowButton(dlg, '메모.html', 'confirm-delete')!)
      await settle(5)

      expect(ed.editable.innerHTML).toContain('화면에 남아야 합니다')
    })

    it('다시 열면 확인이 초기화돼 있습니다', async () => {
      ed = await mount()
      await saveAs(ed, '메모.html')

      let dlg = await openDocuments(ed)
      await click(rowButton(dlg, '메모.html', 'delete')!)
      await settle(4)
      expect(rowButton(dlg, '메모.html', 'confirm-delete')).not.toBeNull()

      const close = [...dlg.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Close'
      )!
      await click(close)
      await settle(4)

      dlg = await openDocuments(ed)

      expect(
        rowButton(dlg, '메모.html', 'confirm-delete'),
        '닫았다 열었는데 지우기 확인이 켜진 채입니다'
      ).toBeNull()
    })
  })
})
