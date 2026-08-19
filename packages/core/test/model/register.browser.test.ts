import { describe, it, expect, beforeEach } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { CommandRegistry } from '@/core/command-registry'
import { EventBus } from '@/core/event-bus'
import { sagakSchema } from '@/model/schema'
import { parseHtml, toHtml } from '@/model/storage'
import { registerModelCommands } from '@/model/register'

/**
 * 모델 커맨드가 레지스트리에서 **먼저 잡는가.**
 *
 * 갈아타기가 한 줄짜리 사건이 되려면 두 가지가 지켜져야 합니다.
 *
 * 1. 상태가 있으면 모델 커맨드가 잡는다 — 아래 층이 안 돈다
 * 2. 상태가 없으면 **안 잡는다** — 뷰가 붙기 전에도 등록해 둘 수 있다
 *
 * 둘째가 이 설계의 값입니다. 뷰가 없는 동안에도 등록해 두고, 뷰가 상태를
 * 내주기 시작하면 그 순간부터 모델 쪽이 맡습니다.
 *
 * 아래 층은 원래 `registerLegacyExecCommands`(= `document.execCommand`)였습니다.
 * 그 층이 **한 번도 안 잡히는 것으로 판명나 지워졌으므로**
 * (`command-layers.browser.test.ts`) 여기서는 흉내 낸 층을 씁니다 — 재려는
 * 것은 아래에 무엇이 있느냐가 아니라 **넘어가느냐**입니다.
 */

let registry: CommandRegistry
let state: EditorState | null
let below: string[]

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

  below = []

  /* 아래 층을 흉내 냅니다 — 잡히면 이름이 남습니다 */
  for (const name of ['bold', 'fontName']) {
    registry.register(
      name,
      () => {
        below.push(name)
        return true
      },
      -100
    )
  }
  registry.registerStateQuery(
    'bold',
    () => {
      below.push('bold?')
      return false
    },
    -100
  )

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

    expect(registry.run('bold')).toBe(true)
    expect(below).toEqual(['bold'])
  })

  it('값을 받는 커맨드도 상태가 없으면 넘깁니다', () => {
    state = null

    expect(registry.run('fontName', 'Georgia')).toBe(true)
    expect(below).toEqual(['fontName'])
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

      expect(registry.queryState('bold')).toBe(false)
      expect(below).toEqual(['bold?'])
    })
  })
})
