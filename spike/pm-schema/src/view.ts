import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { DOMParser, DOMSerializer } from 'prosemirror-model'
import { history, undo, redo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap, toggleMark } from 'prosemirror-commands'
import { sagakSchema } from 'sagak-core'

/**
 * 편집 표면을 `prosemirror-view` 에 맡긴 최소 구성.
 *
 * 이주 2단계가 사는 자리입니다. 여기서 재려는 것은 스키마가 아니라
 * **입력**입니다 — 특히 한글 조합.
 *
 * ## 왜 최소인가
 *
 * 툴바도 플러그인도 없습니다. `EditorView` 가 contentEditable 을 가져갔을 때
 * 무엇이 되는지만 봅니다. 여기서 안 되는 것은 나중에도 안 됩니다.
 */

export interface Spike {
  view: EditorView
  /** 지금 문서를 HTML 로 — 저장되는 꼴입니다 */
  html: () => string
  text: () => string
  undo: () => boolean
  redo: () => boolean
  bold: () => boolean
  destroy: () => void
}

export function mountView(container: HTMLElement, html: string): Spike {
  const source = document.createElement('div')
  source.innerHTML = html

  const state = EditorState.create({
    doc: DOMParser.fromSchema(sagakSchema).parse(source),
    plugins: [
      history(),
      keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Shift-Mod-z': redo }),
      keymap(baseKeymap),
    ],
  })

  const view = new EditorView(container, { state })

  const run = (command: (s: typeof view.state, d: typeof view.dispatch) => boolean) => () =>
    command(view.state, view.dispatch)

  return {
    view,
    html: () => {
      const fragment = DOMSerializer.fromSchema(sagakSchema).serializeFragment(
        view.state.doc.content,
        { document }
      )
      const out = document.createElement('div')
      out.appendChild(fragment)
      return out.innerHTML
    },
    text: () => view.state.doc.textBetween(0, view.state.doc.content.size, '\n'),
    undo: run(undo),
    redo: run(redo),
    bold: run(toggleMark(sagakSchema.marks.strong)),
    destroy: () => view.destroy(),
  }
}
