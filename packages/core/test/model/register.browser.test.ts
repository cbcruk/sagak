import { describe, it, expect, beforeEach } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { CommandRegistry } from '@/core/command-registry'
import { EventBus } from '@/core/event-bus'
import { registerLegacyExecCommands } from '@/core/legacy-exec-command'
import { sagakSchema } from '@/model/schema'
import { parseHtml, toHtml } from '@/model/storage'
import { registerModelCommands } from '@/model/register'

/**
 * 모델 커맨드가 레지스트리에서 **먼저 잡는가.**
 *
 * 갈아타기가 한 줄짜리 사건이 되려면 두 가지가 지켜져야 합니다.
 *
 * 1. 상태가 있으면 모델 커맨드가 잡는다 — 아래 층(`execCommand`)이 안 돈다
 * 2. 상태가 없으면 **안 잡는다** — 뷰가 붙기 전에도 등록해 둘 수 있다
 *
 * 둘째가 이 설계의 값입니다. 뷰가 없는 동안에도 등록해 두고, 뷰가 상태를
 * 내주기 시작하면 그 순간부터 모델 쪽이 맡습니다.
 */

let registry: CommandRegistry
let state: EditorState | null

const html = (): string => toHtml(state!.doc, sagakSchema, document)

function load(source: string): void {
  const doc = parseHtml(source, sagakSchema, document)
  const created = EditorState.create({ doc })

  state = created.apply(
    created.tr.setSelection(
      TextSelection.create(created.doc, 1, created.doc.content.size - 1)
    )
  )
}

beforeEach(() => {
  registry = new CommandRegistry({ eventBus: new EventBus() })

  /* 지금 제품과 같은 순서로 쌓습니다 — 레거시가 맨 아래입니다 */
  registerLegacyExecCommands(registry)
  registerModelCommands(registry, {
    getState: () => state,
    dispatch: (tr) => {
      state = state!.apply(tr)
    },
  })
})

describe('모델 커맨드를 레지스트리에 얹기', () => {
  it('상태가 있으면 모델 쪽이 잡습니다', () => {
    load('<p>가나다라</p>')

    expect(registry.run('bold')).toBe(true)
    expect(html()).toContain('<strong>')
  })

  it('값을 받는 커맨드도 잡습니다', () => {
    load('<p>가나다라</p>')

    expect(registry.run('fontName', 'Georgia')).toBe(true)
    expect(html()).toContain('font-family: Georgia')
  })

  /**
   * 이게 이 층의 요지입니다.
   *
   * 뷰가 아직 없으면 상태도 없고, 그러면 모델 커맨드는 **처리하지 않았다** 고
   * 답해 아래 precedence 로 넘깁니다. 등록해 두는 것만으로는 아무것도 안
   * 바뀝니다.
   */
  it('상태가 없으면 안 잡고 아래로 넘깁니다', () => {
    state = null

    const element = document.createElement('div')
    element.contentEditable = 'true'
    element.innerHTML = '<p>가나다라</p>'
    document.body.appendChild(element)

    const text = element.querySelector('p')!.firstChild!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 4)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    /* 레거시(`execCommand`)가 받아서 DOM 을 고칩니다 */
    registry.run('bold')

    expect(element.innerHTML).toContain('<b>')
    element.remove()
  })

  describe('조회', () => {
    it('눌림 표시를 모델에서 읽습니다', () => {
      load('<p><strong>가나다라</strong></p>')

      expect(registry.queryState('bold')).toBe(true)
    })

    it('셀렉트 값을 모델에서 읽습니다', () => {
      load('<p><span style="font-family: Georgia">가나</span></p>')

      expect(registry.queryValue('fontName')).toBe('Georgia')
    })

    it('상태가 없으면 조회도 아래로 넘깁니다', () => {
      state = null

      /* 던지지 않고 아래 층의 답이 나옵니다 */
      expect(() => registry.queryState('bold')).not.toThrow()
    })
  })
})
