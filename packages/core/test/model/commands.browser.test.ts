import { describe, it, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { sagakSchema } from '@/model/schema'
import { parseHtml, toHtml } from '@/model/storage'
import {
  commands,
  isMarkActive,
  markValue,
  blockAttr,
  type Command,
} from '@/model/commands'

/**
 * 툴바 커맨드를 **뷰 없이** 잽니다.
 *
 * `EditorState` 만으로 도는 것이 이 층의 요지입니다 — `EditorView` 가 아직
 * 안 들어왔고, 들어오기 전에 완성돼 있어야 모델과 DOM 이 어긋나는 구간이
 * 생기지 않습니다.
 *
 * 그래서 검사도 DOM 을 안 씁니다. 문서를 만들고, 범위를 고르고, 커맨드를 돌리고,
 * HTML 로 뽑아 봅니다.
 */

function stateOf(html: string): EditorState {
  return EditorState.create({ doc: parseHtml(html, sagakSchema, document) })
}

/** 문서 전체를 고릅니다 — 툴바를 누르기 직전 상태입니다 */
function selectAll(state: EditorState): EditorState {
  return state.apply(
    state.tr.setSelection(
      TextSelection.create(state.doc, 1, state.doc.content.size - 1)
    )
  )
}

function run(state: EditorState, command: Command): EditorState {
  let next = state

  command(state, (tr) => {
    next = state.apply(tr)
  })

  return next
}

const html = (state: EditorState): string =>
  toHtml(state.doc, sagakSchema, document)

describe('툴바 커맨드 — EditorState 위에서', () => {
  describe('인라인 토글', () => {
    const CASES: Array<[string, Command, string]> = [
      ['굵게', commands.bold, '<strong>'],
      ['기울임', commands.italic, '<em>'],
      ['밑줄', commands.underline, '<u>'],
      ['취소선', commands.strikeThrough, '<s>'],
      ['아래첨자', commands.subscript, '<sub>'],
      ['위첨자', commands.superscript, '<sup>'],
    ]

    for (const [name, command, tag] of CASES) {
      it(name, () => {
        const state = selectAll(stateOf('<p>가나다라</p>'))

        expect(html(run(state, command))).toContain(tag)
      })
    }

    it('한 번 더 누르면 꺼집니다', () => {
      const state = selectAll(stateOf('<p><strong>가나다라</strong></p>'))

      expect(html(run(state, commands.bold))).not.toContain('<strong>')
    })

    it('`dispatch` 를 안 주면 할 수 있는지만 답합니다', () => {
      const state = selectAll(stateOf('<p>가나다라</p>'))

      expect(commands.bold(state)).toBe(true)
      /* 아무것도 안 바뀌어야 합니다 */
      expect(html(state)).toBe('<p>가나다라</p>')
    })
  })

  describe('값이 붙는 마크', () => {
    it('글꼴을 겁니다', () => {
      const state = selectAll(stateOf('<p>가나다라</p>'))
      const next = run(state, commands.fontName('Georgia'))

      expect(html(next)).toContain('font-family: Georgia')
    })

    /**
     * 토글이 아니라 **덮어쓰기**입니다. 글꼴을 바꾸는 것은 끄고 켜는 것이
     * 아니라 값을 바꾸는 것이라, 두 번 걸면 마지막 값 하나만 남아야 합니다.
     */
    it('다시 걸면 값이 바뀝니다 — 겹치지 않습니다', () => {
      let state = selectAll(stateOf('<p>가나다라</p>'))
      state = run(state, commands.fontName('Georgia'))
      state = selectAll(state)
      state = run(state, commands.fontName('Arial'))

      const out = html(state)
      expect(out).toContain('font-family: Arial')
      expect(out).not.toContain('Georgia')
    })

    it('지금 값을 읽습니다', () => {
      let state = selectAll(stateOf('<p>가나다라</p>'))
      state = run(state, commands.fontSize('24px'))

      expect(markValue(selectAll(state), sagakSchema.marks.fontSize)).toBe(
        '24px'
      )
    })
  })

  describe('블록', () => {
    it('제목으로 바꿉니다', () => {
      const state = selectAll(stateOf('<p>가나다라</p>'))

      expect(html(run(state, commands.heading(2)))).toBe('<h2>가나다라</h2>')
    })

    it('가운데 정렬', () => {
      const state = selectAll(stateOf('<p>가나다라</p>'))

      expect(html(run(state, commands.justifyCenter))).toContain(
        'text-align: center'
      )
    })

    it('들여쓰고 되돌립니다', () => {
      let state = selectAll(stateOf('<p>가나다라</p>'))
      state = run(state, commands.indent)
      expect(html(state)).toContain('margin-left: 40px')

      state = run(selectAll(state), commands.outdent)
      expect(html(state)).not.toContain('margin-left')
    })

    it('선택이 걸친 문단마다 답니다', () => {
      const state = selectAll(stateOf('<p>하나</p><p>둘</p>'))
      const out = html(run(state, commands.justifyRight))

      expect(out.match(/text-align: right/g)).toHaveLength(2)
    })
  })

  describe('목록', () => {
    it('글머리 목록으로 감쌉니다', () => {
      const state = selectAll(stateOf('<p>가나다라</p>'))

      expect(html(run(state, commands.insertUnorderedList))).toBe(
        '<ul><li><p>가나다라</p></li></ul>'
      )
    })

    it('번호 목록으로 감쌉니다', () => {
      const state = selectAll(stateOf('<p>가나다라</p>'))

      expect(html(run(state, commands.insertOrderedList))).toContain('<ol>')
    })
  })

  it('가로줄을 넣습니다', () => {
    const state = selectAll(stateOf('<p>가나다라</p>'))

    expect(html(run(state, commands.insertHorizontalRule))).toContain('<hr>')
  })

  describe('지금 상태 읽기 — 툴바의 눌림 표시', () => {
    it('마크가 걸려 있는지', () => {
      const plain = selectAll(stateOf('<p>가나다라</p>'))
      const bold = selectAll(stateOf('<p><strong>가나다라</strong></p>'))

      expect(isMarkActive(plain, sagakSchema.marks.strong)).toBe(false)
      expect(isMarkActive(bold, sagakSchema.marks.strong)).toBe(true)
    })

    it('문단 속성', () => {
      const state = selectAll(stateOf('<p style="text-align: center">가</p>'))

      expect(blockAttr(state, 'align')).toBe('center')
    })
  })
})
