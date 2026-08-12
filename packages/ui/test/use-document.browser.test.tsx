import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import type { ComponentChildren } from 'preact'
import { EditorProvider } from '../src/context/editor-context'
import { useDocument, UNTITLED } from '../src/hooks'
import type { UseDocumentReturn } from '../src/hooks'
import { mountEditor, settle } from './harness'
import type { MountedEditor } from './harness'

/**
 * 열려 있는 문서 하나 — 레거시 텍스트 에디터의 상태입니다.
 *
 * 자동 저장이 없으므로 여기서 지켜야 할 것이 분명합니다: 시키지 않으면 아무것도
 * 저장되지 않고, 저장한 뒤에는 깨끗하고, 고치면 더러워지고, 연 것이 화면에
 * 들어옵니다.
 *
 * `dirty` 는 **플래그가 아니라 비교**입니다. 자동 저장의 `isDirty` 가 여러
 * 자리에서 갱신되다 어긋났던 것과 반대로 갑니다 — 아래 "저장한 내용으로 되돌려
 * 놓으면 다시 깨끗해집니다" 가 그 차이를 잡습니다. 플래그였다면 한 번
 * 더러워진 뒤 되돌려도 더러운 채로 남습니다.
 */

let ed: MountedEditor | null = null
let root: HTMLElement | null = null
let doc: UseDocumentReturn | null = null

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

function Probe(): ComponentChildren {
  doc = useDocument()
  return null
}

/** 에디터를 띄우고 그 컨텍스트로 훅을 붙입니다 */
async function mount(content = '<p>처음</p>'): Promise<void> {
  ed = await mountEditor(content)
  root = document.createElement('div')
  document.body.appendChild(root)
  render(
    <EditorProvider context={ed.context}>
      <Probe />
    </EditorProvider>,
    root
  )
  await settle(5)
  await doc!.create()
  await settle(3)
}

/**
 * 사용자가 친 것처럼 내용을 바꿉니다.
 *
 * 캐럿은 안 놓습니다 — 빈 문서에는 놓을 텍스트 노드가 없고, 이 훅이 보는 것은
 * 캐럿이 아니라 내용 변경 이벤트입니다.
 */
async function type(html: string): Promise<void> {
  ed!.editable.innerHTML = html
  ed!.editable.dispatchEvent(new InputEvent('input', { bubbles: true }))
  await settle(6)
}

beforeEach(clearStorage)

afterEach(async () => {
  if (root) render(null, root)
  root?.remove()
  root = null
  ed?.unmount()
  ed = null
  doc = null
  await clearStorage()
})

describe('열려 있는 문서', () => {
  it('처음에는 이름이 없습니다', async () => {
    await mount()

    expect(doc!.name).toBe(UNTITLED)
    expect(doc!.untitled).toBe(true)
    expect(doc!.available).toBe(true)
  })

  it('시키지 않으면 아무것도 저장되지 않습니다', async () => {
    await mount()
    await type('<p>한참 씁니다</p>')

    expect(doc!.dirty).toBe(true)
    await doc!.refresh()
    await settle(2)
    expect(doc!.documents, '자동으로 저장됐습니다').toEqual([])
  })

  /**
   * 그냥 실패하는 것으로는 부족합니다 — 막지 않으면 `null` 이 이름으로 흘러가
   * `Invalid document name: null` 이 납니다. 던지긴 하지만 부르는 쪽이 무엇을
   * 해야 하는지 알 수 없습니다. 그래서 **무엇을 하라고 말하는지**를 봅니다.
   */
  it('이름 없이 저장하려 하면 이름을 받으라고 알려줍니다', async () => {
    await mount()
    await type('<p>글</p>')

    await expect(doc!.save()).rejects.toThrow(/saveAs/)
  })

  /**
   * 저장은 **그 순간의 편집 영역**을 읽어야 합니다.
   *
   * 내용 변경 이벤트를 받아 두는 값은 비동기로 채워지므로, 치자마자 저장하면
   * 아직 예전 값입니다. 그 값을 쓰면 방금 친 글이 빠진 채로 저장됩니다.
   */
  it('치자마자 저장해도 방금 친 글이 들어갑니다', async () => {
    await mount()
    await doc!.saveAs('메모.html')
    await settle(3)

    // 이벤트가 정리될 틈을 주지 않고 곧바로 저장합니다
    ed!.editable.innerHTML = '<p>막 친 글</p>'
    ed!.editable.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await doc!.save()
    await settle(3)

    await doc!.create()
    await doc!.open('메모.html')
    await settle(3)

    expect(ed!.editable.innerHTML, '방금 친 글이 빠졌습니다').toContain(
      '막 친 글'
    )
  })

  it('다른 이름으로 저장하면 이름이 붙고 깨끗해집니다', async () => {
    await mount()
    await type('<p>저장할 글</p>')

    await doc!.saveAs('메모.html')
    await settle(3)

    expect(doc!.name).toBe('메모.html')
    expect(doc!.untitled).toBe(false)
    expect(doc!.dirty).toBe(false)
    expect(doc!.documents.map((d) => d.name)).toEqual(['메모.html'])
  })

  it('저장한 뒤 고치면 더러워지고, 다시 저장하면 깨끗해집니다', async () => {
    await mount()
    await doc!.saveAs('메모.html')
    await settle(3)
    expect(doc!.dirty).toBe(false)

    await type('<p>고쳤습니다</p>')
    expect(doc!.dirty).toBe(true)

    await doc!.save()
    await settle(3)
    expect(doc!.dirty).toBe(false)
  })

  /**
   * `dirty` 가 비교라서 성립합니다. 플래그였다면 한 번 켜진 뒤 내용을 되돌려도
   * 켜진 채로 남습니다.
   */
  it('저장한 내용으로 되돌려 놓으면 다시 깨끗해집니다', async () => {
    await mount()
    await type('<p>원래대로</p>')
    await doc!.saveAs('메모.html')
    await settle(3)

    await type('<p>다른 글</p>')
    expect(doc!.dirty).toBe(true)

    await type('<p>원래대로</p>')

    expect(doc!.dirty, '내용이 같은데 더럽다고 합니다').toBe(false)
  })

  it('연 문서가 화면에 들어오고 깨끗한 상태입니다', async () => {
    await mount()
    await type('<p>첫째 문서</p>')
    await doc!.saveAs('첫째.html')
    await settle(3)

    await doc!.create()
    await type('<p>둘째 문서</p>')
    await doc!.saveAs('둘째.html')
    await settle(3)

    await doc!.open('첫째.html')
    await settle(3)

    expect(ed!.editable.innerHTML).toContain('첫째 문서')
    expect(doc!.name).toBe('첫째.html')
    expect(doc!.dirty).toBe(false)
  })

  it('새로 만들면 빈 문서에서 이름 없이 시작합니다', async () => {
    await mount()
    await type('<p>쓰던 글</p>')
    await doc!.saveAs('메모.html')
    await settle(3)

    await doc!.create()
    await settle(3)

    expect(doc!.untitled).toBe(true)
    expect(doc!.dirty).toBe(false)
    expect(ed!.editable.innerHTML).not.toContain('쓰던 글')
  })

  it('이름을 바꾸면 목록에서도 바뀝니다', async () => {
    await mount()
    await type('<p>내용은 그대로</p>')
    await doc!.saveAs('예전.html')
    await settle(3)

    await doc!.rename('새이름.html')
    await settle(3)

    expect(doc!.name).toBe('새이름.html')
    expect(doc!.documents.map((d) => d.name)).toEqual(['새이름.html'])
  })

  it('이름 없는 문서의 이름을 바꾸면 그 이름으로 저장됩니다', async () => {
    await mount()
    await type('<p>이름 없이 쓰던 글</p>')

    await doc!.rename('처음이름.html')
    await settle(3)

    expect(doc!.untitled).toBe(false)
    expect(doc!.name).toBe('처음이름.html')
    expect(doc!.dirty).toBe(false)
  })

  /**
   * 열어 둔 문서를 지웠다고 화면의 글까지 지우면 안 됩니다 — 사용자가 시킨
   * 일이 아닙니다. 이름만 떼고 다음 저장에서 이름을 묻습니다.
   */
  it('열어 둔 문서를 지워도 쓰던 글은 화면에 남습니다', async () => {
    await mount()
    await type('<p>지워도 남아야 합니다</p>')
    await doc!.saveAs('메모.html')
    await settle(3)

    await doc!.remove('메모.html')
    await settle(3)

    expect(ed!.editable.innerHTML).toContain('지워도 남아야 합니다')
    expect(doc!.untitled).toBe(true)
    expect(doc!.documents).toEqual([])
  })

  it('목록은 최근에 고친 것이 앞입니다', async () => {
    await mount()
    await doc!.saveAs('첫째.html')
    await settle(3)
    await new Promise((resolve) => setTimeout(resolve, 20))
    await doc!.create()
    await doc!.saveAs('둘째.html')
    await settle(3)

    expect(doc!.documents.map((d) => d.name)).toEqual([
      '둘째.html',
      '첫째.html',
    ])
  })
})
