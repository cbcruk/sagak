import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  canSaveToComputer,
  saveToComputer,
} from '../src/components/document-bar/document-bar.utils'
import { mountEditor, settle, click } from './harness'
import type { MountedEditor } from './harness'

/**
 * 진짜 파일로 꺼내기.
 *
 * ## 여기서 진짜 대화상자는 못 띄웁니다
 *
 * 헤드리스에는 파일 대화상자가 없어서 `showSaveFilePicker()` 가 곧바로
 * `AbortError` 로 끝납니다. 재 봤습니다 —
 *
 * | 부른 자리 | 결과 |
 * | --- | --- |
 * | 제스처 밖 | `SecurityError: Must be handling a user gesture…` |
 * | 클릭 핸들러 안 | `AbortError: The user aborted a request` |
 *
 * 그래서 **고르고 난 뒤의 우리 코드**를 봅니다 — 무엇을 이름으로 제안하고,
 * 무엇을 쓰고, 취소를 어떻게 다루는지. 사람이 파일을 고르는 부분은 이
 * 환경에서 확인할 수 없고, 그건 이 테스트가 덮지 못하는 자리입니다.
 */

type Picker = (options?: {
  suggestedName?: string
}) => Promise<FileSystemFileHandle>

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

const original = (window as unknown as { showSaveFilePicker?: Picker })
  .showSaveFilePicker

function setPicker(value: Picker | undefined): void {
  const w = window as unknown as { showSaveFilePicker?: Picker }
  if (value === undefined) delete w.showSaveFilePicker
  else w.showSaveFilePicker = value
}

/** 고른 파일을 흉내 냅니다 — 쓴 내용을 모아 둡니다 */
function fakeFile(): {
  handle: FileSystemFileHandle
  written: () => string
} {
  let buffer = ''
  const handle = {
    createWritable: async () => ({
      write: async (chunk: string) => {
        buffer += chunk
      },
      close: async () => {},
    }),
  } as unknown as FileSystemFileHandle
  return { handle, written: () => buffer }
}

beforeEach(clearStorage)

afterEach(async () => {
  ed?.unmount()
  ed = null
  setPicker(original)
  vi.restoreAllMocks()
  await clearStorage()
})

describe('내 컴퓨터에 저장', () => {
  it('이 브라우저에는 있습니다', () => {
    expect(canSaveToComputer()).toBe(true)
  })

  it('없는 브라우저에서는 없다고 합니다', () => {
    setPicker(undefined)

    expect(canSaveToComputer()).toBe(false)
  })

  it('고른 파일에 지금 내용을 씁니다', async () => {
    const file = fakeFile()
    const seen: Array<string | undefined> = []
    setPicker(async (options) => {
      seen.push(options?.suggestedName)
      return file.handle
    })

    const saved = await saveToComputer('메모.html', async () => '<p>내용</p>')

    expect(saved).toBe(true)
    expect(seen).toEqual(['메모.html'])
    expect(file.written()).toBe('<p>내용</p>')
  })

  /**
   * 대화상자를 **먼저** 띄우고 내용을 나중에 읽어야 합니다. 순서가 바뀌면 그
   * 사이의 `await` 가 사용자 제스처를 잃습니다.
   */
  it('내용은 파일을 고른 뒤에 읽습니다', async () => {
    const order: string[] = []
    const file = fakeFile()
    setPicker(async () => {
      order.push('picker')
      return file.handle
    })

    await saveToComputer('메모.html', async () => {
      order.push('read')
      return '<p>내용</p>'
    })

    expect(order).toEqual(['picker', 'read'])
  })

  it('취소하면 아무것도 쓰지 않고 조용히 끝납니다', async () => {
    let read = false
    setPicker(async () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    })

    const saved = await saveToComputer('메모.html', async () => {
      read = true
      return '<p>내용</p>'
    })

    expect(saved).toBe(false)
    expect(read, '취소했는데 내용을 읽었습니다').toBe(false)
  })

  it('취소가 아닌 오류는 감추지 않습니다', async () => {
    setPicker(async () => {
      throw Object.assign(new Error('nope'), { name: 'NotAllowedError' })
    })

    await expect(
      saveToComputer('메모.html', async () => '<p>내용</p>')
    ).rejects.toThrow('nope')
  })

  describe('문서 줄에서', () => {
    const barPart = <T extends HTMLElement>(e: MountedEditor, part: string): T =>
      e.root.querySelector<T>(
        `[data-scope="document-bar"] [data-part="${part}"]`
      )!

    it('쓸 수 있으면 버튼이 있고, 지금 문서 이름을 제안합니다', async () => {
      const file = fakeFile()
      const seen: Array<string | undefined> = []
      setPicker(async (options) => {
        seen.push(options?.suggestedName)
        return file.handle
      })

      ed = await mountEditor('<p>꺼낼 글</p>', { showDocumentBar: true })
      await settle(5)
      await click(barPart(ed, 'new'))
      await settle(3)

      ed.editable.innerHTML = '<p>꺼낼 글</p>'
      ed.editable.dispatchEvent(new InputEvent('input', { bubbles: true }))
      await settle(5)

      await click(barPart(ed, 'save-to-computer'))
      await settle(6)

      expect(seen, '이름 없는 문서는 Untitled 로 제안해야 합니다').toEqual([
        'Untitled.html',
      ])
      expect(file.written()).toContain('꺼낼 글')
    })

    it('쓸 수 없는 브라우저에서는 버튼이 안 나옵니다', async () => {
      setPicker(undefined)

      ed = await mountEditor('<p>글</p>', { showDocumentBar: true })
      await settle(5)

      expect(
        ed.root.querySelector(
          '[data-scope="document-bar"] [data-part="save-to-computer"]'
        )
      ).toBeNull()
    })
  })
})
