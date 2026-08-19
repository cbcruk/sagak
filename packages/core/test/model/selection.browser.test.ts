import { describe, it, expect } from 'vitest'
import { EditorState, NodeSelection, TextSelection } from 'prosemirror-state'
import { sagakSchema } from '@/model/schema'
import { parseHtml } from '@/model/storage'
import {
  alignmentAt,
  imageFactsAt,
  isCaretInTable,
  linkAt,
  linkRangeAt,
  listKindAt,
} from '@/model/selection'
import { removeLink, createLink } from '@/model/commands'
import { toHtml } from '@/model/storage'

/**
 * **선택이 지금 무엇 위에 있는가** — 툴바가 묻는 것들.
 *
 * 이 답들은 원래 UI 에 있었습니다. `window.getSelection()` 으로 캐럿을 잡고
 * `parentNode` 를 타고 올라가며 `TABLE`·`OL`·`A` 태그를 찾았고, 정렬은
 * `getComputedStyle(...).textAlign` 을 읽었습니다.
 *
 * 그 방식은 **DOM 이 진실이라는 전제** 위에 서 있었습니다. 목록 항목이
 * `<li><p>` 로 그려지기 시작하자마자 흔들릴 자리이기도 했습니다. 여기서는
 * 문서 구조에 직접 묻습니다.
 */

const stateOf = (html: string): EditorState =>
  EditorState.create({ doc: parseHtml(html, sagakSchema, document) })

/** 캐럿을 첫 글자 앞에 둡니다 */
const caret = (state: EditorState, at = 1): EditorState =>
  state.apply(state.tr.setSelection(TextSelection.create(state.doc, at)))

const all = (state: EditorState): EditorState =>
  state.apply(
    state.tr.setSelection(
      TextSelection.create(state.doc, 1, state.doc.content.size - 1)
    )
  )

describe('선택이 무엇 위에 있는가', () => {
  describe('정렬', () => {
    it('안 정해져 있으면 왼쪽입니다', () => {
      expect(alignmentAt(caret(stateOf('<p>가나</p>')))).toBe('left')
    })

    it('문단에 붙은 값을 읽습니다', () => {
      const state = caret(stateOf('<p style="text-align: center">가나</p>'))

      expect(alignmentAt(state)).toBe('center')
    })
  })

  describe('목록', () => {
    /**
     * Why: 예전에는 캐럿에서 올라가며 `OL`/`UL` 태그를 찾았습니다.
     * How: 항목이 문단을 감싸도(`<li><p>`) 문서 구조는 그대로라 안 흔들립니다.
     */
    it('글머리와 번호를 가립니다', () => {
      expect(listKindAt(caret(stateOf('<ul><li>가</li></ul>')))).toBe(
        'unordered'
      )
      expect(listKindAt(caret(stateOf('<ol><li>가</li></ol>')))).toBe('ordered')
    })

    it('목록 밖이면 `none` 입니다', () => {
      expect(listKindAt(caret(stateOf('<p>가나</p>')))).toBe('none')
    })
  })

  describe('표', () => {
    it('셀 안인지 가립니다', () => {
      const table = stateOf('<table><tbody><tr><td>가</td></tr></tbody></table>')

      /* 표 안의 첫 글자 자리 — doc > table > row > cell > p */
      expect(isCaretInTable(caret(table, 4))).toBe(true)
      expect(isCaretInTable(caret(stateOf('<p>가</p>')))).toBe(false)
    })
  })

  describe('링크', () => {
    it('캐럿이 얹혀 있으면 주소를 읽습니다', () => {
      const state = caret(stateOf('<p><a href="https://a.example">가나</a></p>'), 2)

      expect(linkAt(state)?.href).toBe('https://a.example')
    })

    it('링크 밖이면 없습니다', () => {
      expect(linkAt(caret(stateOf('<p>가나</p>')))).toBeNull()
    })

    /**
     * Why: 링크를 벗기려면 캐럿 한 점이 아니라 **링크 전체**가 필요합니다.
     * How: 예전에는 UI 가 DOM 선택을 `<a>` 위로 넓혀 놓고 명령을 불렀습니다 —
     *      부수효과였고 사용자에게도 보였습니다.
     */
    it('캐럿만 얹혀 있어도 범위를 찾습니다', () => {
      const state = caret(stateOf('<p><a href="https://a.example">가나</a>다</p>'), 2)
      const range = linkRangeAt(state)

      expect(range).toEqual({ from: 1, to: 3 })
    })

    it('캐럿만 얹혀 있어도 벗겨집니다', () => {
      const state = caret(stateOf('<p><a href="https://a.example">가나</a>다</p>'), 2)
      let next = state

      removeLink(state, (tr) => {
        next = state.apply(tr)
      })

      expect(toHtml(next.doc, sagakSchema, document)).toBe('<p>가나다</p>')
    })

    it('캐럿만 있으면 링크를 못 겁니다 — 범위가 필요합니다', () => {
      expect(createLink('https://a.example')(caret(stateOf('<p>가나</p>')))).toBe(
        false
      )
    })

    it('고른 범위에 링크를 겁니다', () => {
      const state = all(stateOf('<p>가나</p>'))
      let next = state

      createLink('https://a.example')(state, (tr) => {
        next = state.apply(tr)
      })

      expect(toHtml(next.doc, sagakSchema, document)).toContain(
        'href="https://a.example"'
      )
    })
  })

  describe('이미지', () => {
    const withImage = '<p><img src="https://a.example/a.png" alt="가"></p>'

    it('통째로 골랐을 때 속성을 읽습니다', () => {
      const base = stateOf(withImage)
      const state = base.apply(
        base.tr.setSelection(NodeSelection.create(base.doc, 1))
      )

      expect(imageFactsAt(state)?.alt).toBe('가')
    })

    it('캐럿이 바로 뒤에 있어도 찾습니다', () => {
      expect(imageFactsAt(caret(stateOf(withImage), 2))?.src).toBe(
        'https://a.example/a.png'
      )
    })

    it('이미지가 없으면 없습니다', () => {
      expect(imageFactsAt(caret(stateOf('<p>가나</p>')))).toBeNull()
    })
  })
})
