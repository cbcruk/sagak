import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { trackComposition } from '@/core/composition'
import { PluginManager } from '@/core/plugin-manager'
import { createAutocompletePlugin } from '@/plugins/autocomplete-plugin'
import type { EditorContext } from '@/core/types'

/**
 * 자동 완성이 어떤 글자에서 동작하는가.
 *
 * 예전 구현은 `/\b[a-zA-Z가-힣]+\b/g`(사전)와 `[a-zA-Z가-힣]+$`(접두사)를
 * 썼습니다. 실제로 재보니 —
 *
 * | 언어 | 고치기 전 |
 * | --- | --- |
 * | 영어 | 동작 |
 * | **한국어** | **제안 없음** |
 * | 악센트 라틴 | `café` 누락 (`é` 가 클래스 밖) |
 * | 일본어·중국어·키릴 | 제안 없음 |
 * | 숫자 섞인 단어 | `item1`·`item2` 누락 |
 *
 * 한국어가 안 되던 이유는 클래스가 아니라 **`\b`** 입니다. JS 의 `\b` 는
 * `\w`(ASCII) 기준이라 한글 앞뒤에서 성립하지 않습니다 — 찾기의 단어 단위
 * 검색이 0개를 돌려주던 것과 같은 원인입니다.
 */
describe('자동 완성 — 언어 범위', () => {
  let eventBus: EventBus
  let element: HTMLDivElement

  beforeEach(async () => {
    element = document.createElement('div')
    element.contentEditable = 'true'
    document.body.appendChild(element)

    eventBus = new EventBus()
    const context: EditorContext = {
      eventBus,
      composition: trackComposition(element),
      element,
      config: { element },
    }
    await new PluginManager(context).register(createAutocompletePlugin())
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  /** 캐럿을 마지막 문단 끝에 두고 키업을 흘려 제안을 받습니다 */
  const suggest = async (html: string): Promise<string[] | null> => {
    element.innerHTML = html

    const paragraphs = element.querySelectorAll('p')
    const target = paragraphs[paragraphs.length - 1].firstChild!
    const range = document.createRange()
    range.setStart(target, target.textContent!.length)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    let shown: string[] | null = null
    const unsub = eventBus.on('AUTOCOMPLETE_SHOW', (data: unknown) => {
      shown = (data as { suggestions: string[] }).suggestions
    })

    eventBus.emit('WYSIWYG_KEYUP', {
      event: new KeyboardEvent('keyup', { key: 'x' }),
    })
    // 플러그인 기본 디바운스(100ms)를 넘겨 기다립니다
    await new Promise((resolve) => setTimeout(resolve, 250))
    unsub()

    return shown
  }

  it('영어 — 그대로 동작해야 함', async () => {
    expect(await suggest('<p>apple apply apricot ap</p>')).toEqual([
      'apple',
      'apply',
      'apricot',
    ])
  })

  it('한국어 — 고치기 전에는 아무것도 못 냈습니다', async () => {
    expect(await suggest('<p>사과나무 사과주스 바나나 사과</p>')).toEqual([
      '사과나무',
      '사과주스',
    ])
  })

  it('악센트 붙은 라틴 — café 가 빠지지 않아야 함', async () => {
    expect(await suggest('<p>café cafeteria caramel caf</p>')).toContain('café')
  })

  it('일본어', async () => {
    expect(await suggest('<p>ありがとう ばなな あり</p>')).toContain(
      'ありがとう'
    )
  })

  it('키릴', async () => {
    expect(await suggest('<p>привет природа при</p>')).toEqual([
      'привет',
      'природа',
    ])
  })

  it('숫자가 섞인 단어', async () => {
    expect(await suggest('<p>item1 item2 items item</p>')).toEqual([
      'item1',
      'item2',
      'items',
    ])
  })

  /**
   * `element.textContent` 는 블록을 구분자 없이 이어붙입니다 —
   * `<p>apricot</p><p>banana</p>` 가 `"apricotbanana"` 가 되어 문서에 없는
   * 단어가 사전에 들어갔습니다.
   */
  it('문단 경계에서 단어가 뭉치지 않아야 함', async () => {
    const shown = await suggest('<p>apricot</p><p>banana ba</p>')

    expect(shown).toEqual(['banana'])
    expect(shown).not.toContain('apricotbanana')
  })

  /**
   * 중국어는 **분절 자체는 됩니다.** 아래에서 확인합니다.
   *
   * 다만 제안은 뜨지 않습니다 — `minChars` 기본값이 2 라 한 글자로는 안 되고,
   * 두 글자를 치면 그 두 글자가 이미 완성된 단어라 `findSuggestions` 가
   * 정확 일치를 제외합니다. **CJK 에서 이 기능이 잘 맞지 않는다는 뜻이고,
   * 임계값은 설정이지 버그가 아니라 여기서 정하지 않습니다.**
   */
  it('중국어 — 분절은 되지만 한 글자는 임계값에 걸립니다', async () => {
    const segmented = [
      ...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(
        '中国 中华 中心'
      ),
    ]
      .filter((s) => s.isWordLike)
      .map((s) => s.segment)

    expect(segmented).toEqual(['中国', '中华', '中心'])
    expect(await suggest('<p>中国 中华 中心 中</p>')).toBeNull()
  })
})
