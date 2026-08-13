import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mountEditor, settle, click, dialog } from './harness'
import type { MountedEditor } from './harness'

/**
 * 문서 줄 — 레거시 텍스트 에디터의 제목과 저장 메뉴입니다.
 *
 * 자동 저장이 없으므로 **저장은 여기서만** 일어납니다. 지켜야 할 것은
 * 왕복입니다 — 저장하고 다시 열면 같은 글이 나와야 합니다.
 *
 * 저장 상태는 툴바 구석의 토스트가 아니라 **제목 옆 점 하나**입니다. 예전
 * 자동 저장 표시는 3번 치고 쉬면 6번 바뀌었고, 그래서 내렸습니다. 점은
 * 저장할 때와 고칠 때만 바뀝니다.
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

const bar = (e: MountedEditor): HTMLElement =>
  e.root.querySelector<HTMLElement>('[data-scope="document-bar"]')!

const part = <T extends HTMLElement>(e: MountedEditor, name: string): T =>
  bar(e).querySelector<T>(`[data-part="${name}"]`)!

const titleName = (e: MountedEditor): string =>
  part(e, 'name').textContent ?? ''

const isDirty = (e: MountedEditor): boolean =>
  (part(e, 'dot').textContent ?? '').trim().length > 0

/** 이름을 묻는 자리를 사람 없이 채웁니다 */
function answerName(value: string | null): void {
  vi.spyOn(window, 'prompt').mockReturnValue(value)
}

async function mount(content = '<p>처음</p>'): Promise<MountedEditor> {
  const editor = await mountEditor(content, { showDocumentBar: true })
  await settle(5)

  /*
   * 열려 있는 문서는 **모듈에 있습니다** — 제목·메뉴·목록이 같은 것을 봐야
   * 하기 때문입니다 (`use-document`). 실제 페이지에서는 새로 열면 초기화되지만
   * 테스트는 한 페이지 안에서 이어지므로 앞 테스트의 이름이 남습니다.
   *
   * 그래서 사용자가 하는 것과 같은 방법으로 시작합니다 — "New" 를 누릅니다.
   */
  await click(
    editor.root.querySelector<HTMLElement>(
      '[data-scope="document-bar"] [data-part="new"]'
    )!
  )
  await settle(5)
  return editor
}

/** 문서 목록 다이얼로그를 열고 그 요소를 돌려줍니다 */
async function openDocuments(e: MountedEditor): Promise<HTMLDialogElement> {
  await click(part(e, 'documents'))
  await settle(4)
  return dialog('Documents')
}

const rowNames = (dlg: HTMLDialogElement): string[] =>
  [...dlg.querySelectorAll<HTMLElement>('[data-part="row"]')].map(
    (row) => row.dataset.name ?? ''
  )

const rowButton = (
  dlg: HTMLDialogElement,
  name: string,
  part: string
): HTMLButtonElement =>
  dlg.querySelector<HTMLButtonElement>(
    `[data-part="row"][data-name="${name}"] [data-part="${part}"]`
  )!

async function type(e: MountedEditor, html: string): Promise<void> {
  e.editable.innerHTML = html
  e.editable.dispatchEvent(new InputEvent('input', { bubbles: true }))
  await settle(6)
}

describe('문서 줄', () => {
  it('이름 없는 문서로 시작합니다', async () => {
    ed = await mount()

    expect(titleName(ed)).toBe('Untitled')
  })

  /**
   * 메뉴 자리는 kinu `Menubar` 입니다 — 버튼 다섯 개가 아니라 한 줄이어야
   * 합니다. 되돌리면(평범한 `<span>`/`<button>`) 이 검사가 먼저 걸립니다.
   *
   * 동작은 넘기지 않았습니다. 항목은 여전히 한 번 누르면 그 동작이 바로
   * 일어나고, 그건 아래 저장·열기 검사들이 그대로 지킵니다.
   */
  it('메뉴가 kinu Menubar 이고 항목은 테두리가 없습니다', async () => {
    ed = await mount()

    const actions = part(ed, 'actions')
    expect(actions.getAttribute('k')).toBe('menubar')

    const items = [
      ...actions.querySelectorAll<HTMLElement>('[k="menubar-item"]'),
    ]
    expect(items.map((el) => el.dataset.part)).toEqual([
      'new',
      'documents',
      'save',
      'save-as',
      // 진짜 파일 저장은 Chromium 계열에만 나옵니다
      ...(actions.querySelector('[data-part="save-to-computer"]')
        ? ['save-to-computer']
        : []),
    ])

    // 다이얼로그를 여는 항목도 같은 줄에 서야 합니다 (`document-dialog`)
    expect(part(ed, 'documents').getAttribute('k')).toBe('menubar-item')

    // 테두리와 배경은 hover 에서만 드러납니다
    const style = getComputedStyle(items[0])
    expect(style.borderTopColor).toBe('rgba(0, 0, 0, 0)')
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)')

    // 다만 높이는 툴바 컨트롤과 같은 토큰이라 줄이 들쭉날쭉하지 않습니다
    const iconButton = ed.root.querySelector('[data-part="icon-button"]')!
    expect(style.height).toBe(getComputedStyle(iconButton).height)
  })

  it('저장하면 이름이 붙고 점이 사라집니다', async () => {
    ed = await mount()
    await type(ed, '<p>저장할 글</p>')
    expect(isDirty(ed), '고쳤는데 점이 없습니다').toBe(true)

    answerName('메모.html')
    await click(part(ed, 'save'))
    await settle(5)

    expect(titleName(ed)).toBe('메모.html')
    expect(isDirty(ed), '저장했는데 점이 남아 있습니다').toBe(false)
  })

  it('이름을 묻는 창에서 취소하면 저장하지 않습니다', async () => {
    ed = await mount()
    await type(ed, '<p>글</p>')

    answerName(null)
    await click(part(ed, 'save'))
    await settle(5)

    expect(titleName(ed)).toBe('Untitled')
    expect(isDirty(ed)).toBe(true)
  })

  /** 이 왕복이 이 단계의 전부입니다 */
  it('저장하고 다시 열면 같은 글이 나옵니다', async () => {
    ed = await mount()
    await type(ed, '<p>돌아와야 하는 글</p>')
    answerName('메모.html')
    await click(part(ed, 'save'))
    await settle(5)

    // 새 문서로 갈아탄 뒤
    await click(part(ed, 'new'))
    await settle(5)
    expect(ed.editable.innerHTML).not.toContain('돌아와야 하는 글')

    // 목록에서 다시 엽니다
    const dlg = await openDocuments(ed)
    await click(rowButton(dlg, '메모.html', 'open'))
    await settle(6)

    expect(ed.editable.innerHTML).toContain('돌아와야 하는 글')
    expect(titleName(ed)).toBe('메모.html')
    expect(isDirty(ed)).toBe(false)
  })

  it('저장한 문서가 목록에 나옵니다', async () => {
    ed = await mount()
    answerName('첫째.html')
    await click(part(ed, 'save'))
    await settle(5)

    const dlg = await openDocuments(ed)

    expect(rowNames(dlg)).toContain('첫째.html')
  })

  it('다른 이름으로 저장하면 둘 다 남습니다', async () => {
    ed = await mount()
    await type(ed, '<p>원본</p>')
    answerName('원본.html')
    await click(part(ed, 'save'))
    await settle(5)

    answerName('사본.html')
    await click(part(ed, 'save-as'))
    await settle(5)

    const dlg = await openDocuments(ed)

    expect(titleName(ed)).toBe('사본.html')
    expect(rowNames(dlg).sort()).toEqual(['사본.html', '원본.html'])
  })

  it('⌘S 로도 저장됩니다', async () => {
    ed = await mount()
    await type(ed, '<p>단축키로 저장</p>')

    answerName('단축키.html')
    /*
     * `document` 에 직접 쏘면 `event.target` 이 `document` 가 됩니다. 실제
     * 브라우저에서는 ⌘S 도 **포커스된 엘리먼트**에서 올라오므로 그런 이벤트는
     * 존재하지 않습니다.
     *
     * 그 차이가 실제로 문제를 냈습니다 — 문서 줄의 kinu Menubar 가 같은
     * keydown 을 받아 `target.closest(...)` 를 하다가 터졌고, 테스트는
     * 통과하는데 실행마다 "Unhandled Error" 가 하나 남았습니다.
     *
     * 편집 영역에서 올려 보냅니다. 단축키 핸들러는 `document` 에서 듣고 있으니
     * 버블링으로 똑같이 닿습니다.
     */
    ed.editable.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true })
    )
    await settle(6)

    expect(titleName(ed)).toBe('단축키.html')
    expect(isDirty(ed)).toBe(false)
  })

  /**
   * 점이 나타났다 사라질 때 제목이 밀리면 예전 자동 저장 표시에서 고쳤던 것과
   * 같은 흔들림이 됩니다. 자리를 늘 잡아 둡니다.
   */
  it('점이 생기고 사라져도 제목이 안 밀립니다', async () => {
    ed = await mount()
    answerName('메모.html')
    await click(part(ed, 'save'))
    await settle(5)

    const clean = part(ed, 'name').getBoundingClientRect().left

    await type(ed, '<p>고쳐서 더러워짐</p>')
    expect(isDirty(ed)).toBe(true)
    const dirtyLeft = part(ed, 'name').getBoundingClientRect().left

    expect(dirtyLeft, '점 때문에 제목이 밀렸습니다').toBe(clean)
  })
})
