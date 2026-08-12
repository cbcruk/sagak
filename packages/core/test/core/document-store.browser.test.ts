import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createDocumentStore,
  isDocumentStorageAvailable,
} from '@/core/document-store'

/**
 * 문서 저장소 — 브라우저 안의 파일 시스템(OPFS) 위에 놓입니다.
 *
 * 레거시 텍스트 에디터의 뼈대라 잃으면 안 되는 성질이 분명합니다: 넣은 것이
 * 그대로 나오고, 목록 차례가 흔들리지 않고, 이름을 바꿔도 내용이 남고,
 * 남의 문서를 조용히 덮어쓰지 않습니다.
 */

const store = createDocumentStore()

async function clear(): Promise<void> {
  const root = await navigator.storage.getDirectory()
  const names: string[] = []
  for await (const name of (
    root as unknown as { keys(): AsyncIterable<string> }
  ).keys()) {
    names.push(name)
  }
  for (const name of names) {
    await root.removeEntry(name, { recursive: true }).catch(() => {})
  }
}

beforeEach(clear)
afterEach(clear)

describe('문서 저장소', () => {
  it('이 브라우저에서 쓸 수 있습니다', () => {
    expect(isDocumentStorageAvailable()).toBe(true)
  })

  it('넣은 것이 그대로 나옵니다', async () => {
    const content = '<h1>제목</h1><p>본문입니다</p>'
    await store.write('메모.html', content)

    expect(await store.read('메모.html')).toBe(content)
    expect(await store.has('메모.html')).toBe(true)
  })

  /**
   * 긴 글을 짧은 글로 덮어쓸 때 예전 꼬리가 남으면 안 됩니다.
   *
   * `createWritable()` 기본값이 빈 파일로 시작이라 지금은 공짜로 성립합니다.
   * 그래도 남겨 둡니다 — 누가 `{ keepExistingData: true }` 를 붙이면 여기서
   * 걸립니다.
   */
  it('짧은 내용으로 덮어써도 꼬리가 안 남습니다', async () => {
    await store.write('메모.html', '<p>' + '가'.repeat(5000) + '</p>')
    await store.write('메모.html', '<p>짧게</p>')

    expect(await store.read('메모.html')).toBe('<p>짧게</p>')
  })

  it('없는 문서를 읽으면 실패합니다', async () => {
    await expect(store.read('없는문서.html')).rejects.toThrow()
    expect(await store.has('없는문서.html')).toBe(false)
  })

  describe('목록', () => {
    it('최근에 고친 것이 앞입니다', async () => {
      await store.write('첫째.html', '<p>1</p>')
      await new Promise((resolve) => setTimeout(resolve, 20))
      await store.write('둘째.html', '<p>2</p>')
      await new Promise((resolve) => setTimeout(resolve, 20))
      await store.write('셋째.html', '<p>3</p>')

      const names = (await store.list()).map((item) => item.name)

      expect(names).toEqual(['셋째.html', '둘째.html', '첫째.html'])
    })

    it('다시 저장하면 앞으로 올라옵니다', async () => {
      await store.write('첫째.html', '<p>1</p>')
      await new Promise((resolve) => setTimeout(resolve, 20))
      await store.write('둘째.html', '<p>2</p>')
      await new Promise((resolve) => setTimeout(resolve, 20))
      await store.write('첫째.html', '<p>고침</p>')

      expect((await store.list())[0].name).toBe('첫째.html')
    })

    it('크기와 수정시각을 함께 줍니다', async () => {
      const content = '<p>안녕하세요</p>'
      await store.write('메모.html', content)

      const [item] = await store.list()

      expect(item.name).toBe('메모.html')
      expect(item.size).toBe(new Blob([content]).size)
      expect(item.modifiedAt).toBeGreaterThan(0)
    })

    it('빈 저장소는 빈 목록입니다', async () => {
      expect(await store.list()).toEqual([])
    })
  })

  describe('이름 바꾸기', () => {
    it('내용을 지킨 채 이름만 바뀝니다', async () => {
      const content = '<p>지켜져야 합니다</p>'
      await store.write('예전.html', content)

      await store.rename('예전.html', '새이름.html')

      expect(await store.has('예전.html')).toBe(false)
      expect(await store.read('새이름.html')).toBe(content)
    })

    /**
     * 덮어쓰기를 막지 않으면 다른 이름으로 저장하다가 남의 글이 사라집니다.
     * 되돌릴 방법이 없는 종류라 막습니다.
     */
    it('이미 있는 이름으로는 못 바꿉니다', async () => {
      await store.write('가.html', '<p>가</p>')
      await store.write('나.html', '<p>나</p>')

      await expect(store.rename('가.html', '나.html')).rejects.toThrow()

      expect(await store.read('가.html')).toBe('<p>가</p>')
      expect(await store.read('나.html')).toBe('<p>나</p>')
    })

    it('같은 이름으로 바꾸면 아무 일도 안 합니다', async () => {
      await store.write('메모.html', '<p>그대로</p>')

      await store.rename('메모.html', '메모.html')

      expect(await store.read('메모.html')).toBe('<p>그대로</p>')
    })
  })

  it('지우면 목록에서도 사라집니다', async () => {
    await store.write('버릴것.html', '<p>x</p>')
    await store.remove('버릴것.html')

    expect(await store.has('버릴것.html')).toBe(false)
    expect(await store.list()).toEqual([])
  })

  describe('이름 검사', () => {
    for (const name of [
      '',
      '.',
      '..',
      '폴더/문서.html',
      '역\\슬래시.html',
      '별표*.html',
      '물음표?.html',
    ]) {
      it(`${JSON.stringify(name)} 은 거절합니다`, async () => {
        await expect(store.write(name, '<p>x</p>')).rejects.toThrow()
      })
    }

    /**
     * 공백은 막지 않습니다 — `회의 메모.html` 은 텍스트 에디터에서 자연스러운
     * 이름이고 OPFS 도 받습니다. 금지 목록을 좁힐 때 실수로 딸려 들어가기
     * 쉬운 자리라 못 박아 둡니다.
     */
    it('공백이 든 이름은 받습니다', async () => {
      await store.write('회의 메모.html', '<p>안건</p>')

      expect(await store.read('회의 메모.html')).toBe('<p>안건</p>')
      expect((await store.list())[0].name).toBe('회의 메모.html')
    })
  })

  it('큰 문서도 왕복합니다', async () => {
    const big = '<p>' + '가'.repeat(500_000) + '</p>'

    await store.write('큰글.html', big)

    expect(await store.read('큰글.html')).toBe(big)
    expect((await store.list())[0].size).toBe(new Blob([big]).size)
  })

  it('여러 번 만들어도 같은 곳을 봅니다', async () => {
    await createDocumentStore().write('메모.html', '<p>하나</p>')

    expect(await createDocumentStore().read('메모.html')).toBe('<p>하나</p>')
  })
})
