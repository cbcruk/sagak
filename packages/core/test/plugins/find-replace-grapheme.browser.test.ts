import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { PluginManager } from '@/core/plugin-manager'
import { SelectionManager } from '@/core/selection-manager'
import { FindReplacePlugin } from '@/plugins/find-replace-plugin'
import type { EditorContext } from '@/core/types'

/**
 * 문자소 클러스터 — `reference-codemirror-state.md` §3 점검.
 *
 * 찾기는 정규식 매치의 **코드유닛 오프셋**을 그대로 써서 텍스트 노드를
 * 자릅니다 (`highlightMatch` 의 `substring`). 질의가 결합 시퀀스의 일부와만
 * 일치하면 그 자리에서 클러스터가 쪼개집니다.
 *
 * 아래는 그것이 실제로 일어나는지 확인하는 테스트입니다. 고치기 전에
 * 무엇이 깨지는지부터 확정합니다.
 */

// 🤦🏼‍♂️ = U+1F926 U+1F3FC U+200D U+2642 U+FE0F (코드유닛 7개, 문자소 1개)
const FACEPALM = '\u{1F926}\u{1F3FC}\u{200D}\u{2642}\u{FE0F}'
// 🤦 하나만 (코드유닛 2개) — 위 시퀀스의 앞부분과 같습니다
const BASE = '\u{1F926}'

describe('찾기 — 문자소 클러스터', () => {
  let eventBus: EventBus
  let pluginManager: PluginManager
  let element: HTMLDivElement
  let context: EditorContext

  beforeEach(async () => {
    element = document.createElement('div')
    element.contentEditable = 'true'
    document.body.appendChild(element)

    eventBus = new EventBus()
    context = {
      eventBus,
      selectionManager: new SelectionManager(element),
      config: { element },
    }
    pluginManager = new PluginManager(context)
    await pluginManager.register(FindReplacePlugin)
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  it('길이 계산 전제 확인', () => {
    // Given: 문자소 하나짜리 이모지
    // Then: 코드유닛은 7개, 문자소는 1개
    expect(FACEPALM.length).toBe(7)
    expect([...new Intl.Segmenter().segment(FACEPALM)]).toHaveLength(1)
  })

  it('이모지 앞뒤의 평범한 단어는 정상적으로 찾아야 함', () => {
    // Given: 이모지가 섞인 문서
    element.innerHTML = `<p>hello ${FACEPALM} world</p>`

    // When: 평범한 단어를 찾는다
    eventBus.emit('FIND', { query: 'world' })

    // Then: 정확히 한 번 찾고 이모지는 그대로여야 함
    const highlights = element.querySelectorAll('.find-highlight')
    expect(highlights).toHaveLength(1)
    expect(highlights[0].textContent).toBe('world')
    expect(element.textContent).toContain(FACEPALM)
  })

  it('결합 시퀀스 전체를 질의하면 통째로 잡아야 함', () => {
    // Given
    element.innerHTML = `<p>a${FACEPALM}b</p>`

    // When
    eventBus.emit('FIND', { query: FACEPALM })

    // Then
    const highlights = element.querySelectorAll('.find-highlight')
    expect(highlights).toHaveLength(1)
    expect(highlights[0].textContent).toBe(FACEPALM)
  })

  /**
   * 여기가 §3 이 경고한 지점입니다.
   *
   * `🤦` 는 `🤦🏼‍♂️` 의 앞 두 코드유닛과 같습니다. 고치기 전에는 정규식이
   * 거기서 일치했고 `highlightMatch` 가 그 오프셋에서 노드를 잘라
   * 문자소 하나가 둘로 쪼개졌습니다.
   */
  it('결합 시퀀스의 일부만 질의하면 일치로 치지 않아야 함', () => {
    // Given: 문자소 하나짜리 이모지만 있는 문서
    element.innerHTML = `<p>${FACEPALM}</p>`

    // When: 그 앞부분(기본 이모지)만 찾는다
    eventBus.emit('FIND', { query: BASE })

    // Then: 문자소 중간이므로 일치가 없어야 합니다
    expect(element.querySelectorAll('.find-highlight')).toHaveLength(0)
    expect(element.textContent).toBe(FACEPALM)
  })

  it('결합 시퀀스의 일부는 바꾸기로도 깨지지 않아야 함', () => {
    // Given
    element.innerHTML = `<p>${FACEPALM}</p>`

    // When: 그 일부를 다른 글자로 바꾸려 한다
    eventBus.emit('REPLACE_ALL', { query: BASE, replacement: 'X' })

    // Then: 고치기 전에는 `X🏼‍♂️` 가 되어 피부톤·ZWJ 가 고아로 남았습니다
    expect(element.textContent).toBe(FACEPALM)
    expect([
      ...new Intl.Segmenter().segment(element.textContent!),
    ]).toHaveLength(1)
  })

  /**
   * 이모지보다 이쪽이 큽니다 — 한국어 에디터에서 단어 단위 찾기가 조용히
   * 아무것도 못 찾고 있었습니다. JS 의 `\b` 는 `\w`(ASCII) 기준이라
   * 한글 앞뒤에서 성립하지 않습니다.
   */
  it('한글도 단어 단위로 찾아야 함', () => {
    // Given: 독립된 '사과' 둘과 '사과나무' 하나
    element.innerHTML = '<p>사과 사과나무 사과</p>'

    // When
    eventBus.emit('FIND', { query: '사과', wholeWord: true })

    // Then: 고치기 전에는 0개였습니다
    const highlights = element.querySelectorAll('.find-highlight')
    expect(highlights).toHaveLength(2)
    highlights.forEach((h) => expect(h.textContent).toBe('사과'))
  })

  it('단어 단위가 아니면 부분 일치도 잡아야 함', () => {
    element.innerHTML = '<p>사과 사과나무 사과</p>'

    eventBus.emit('FIND', { query: '사과' })

    expect(element.querySelectorAll('.find-highlight')).toHaveLength(3)
  })

  it('영어 단어 단위는 그대로 동작해야 함', () => {
    element.innerHTML = '<p>cat cats cat</p>'

    eventBus.emit('FIND', { query: 'cat', wholeWord: true })

    const hs = element.querySelectorAll('.find-highlight')
    expect(hs).toHaveLength(2)
    // 한 노드 안의 여러 일치가 전부 제대로 강조되는가
    hs.forEach((h) => expect(h.textContent).toBe('cat'))
  })
})
