import { CommandRegistry } from '@/core/command-registry'
import { trackComposition } from '@/core/composition'
import type { CompositionTracker } from '@/core/composition'
import { PluginManager } from '@/core/plugin-manager'
import { registerDefaultCommands } from '@/core/default-commands'
import { registerModelCommands } from '@/model/register'
import { WysiwygArea } from '@/editor/editing-area/modes/wysiwyg-area'
import type { EditorContext, EditingAreaManager } from '@/core/types'
import { TextSelection } from 'prosemirror-state'

/**
 * 플러그인 검사가 **제품과 같은 바닥** 위에서 돌게 합니다.
 *
 * ## 왜 필요해졌나
 *
 * 예전에는 맨 `contentEditable` div 하나면 됐습니다. 플러그인이 부른 커맨드가
 * `document.execCommand` 로 내려가 그 div 를 고쳤고, 검사는 DOM 을 보면
 * 됐습니다.
 *
 * 서식이 문서 모델 위로 옮겨간 뒤로 그 층이 없습니다. 플러그인은 이름을
 * 레지스트리에 넘기고, 레지스트리는 편집 영역의 상태를 고칩니다. 그래서
 * 검사도 편집 영역을 세워야 합니다.
 *
 * ## 확인은 여전히 DOM 에서 합니다
 *
 * `prosemirror-view` 가 모델을 그 요소에 그리므로 `element.querySelector('strong')`
 * 같은 확인은 그대로 통합니다. 바뀐 것은 **무엇이 그걸 그리는가**이지
 * 결과의 모양이 아닙니다.
 */
export interface PluginArea {
  context: EditorContext
  pluginManager: PluginManager
  composition: CompositionTracker
  registry: CommandRegistry
  area: WysiwygArea
  /** PM 이 그린 편집 요소 — 예전 검사의 `element` 자리입니다 */
  element: HTMLElement
  /** 문서를 갈아 끼우고 전체를 고릅니다 */
  load: (html: string) => void
  /** 지금 문서를 고릅니다 */
  selectAll: () => void
  /** 캐럿만 둡니다 — 범위 없는 상황을 만들 때 */
  collapse: (at?: number) => void
  /** 글자 자리로 고릅니다 — 첫 글자가 1 입니다 */
  select: (from: number, to: number) => void
  /** 지금 문서를 HTML 로 — 모델에서 뽑은 것입니다 */
  html: () => string
  destroy: () => void
}

export function mountPluginArea(initial = '<p>Hello World</p>'): PluginArea {
  window.getSelection()?.removeAllRanges()

  const container = document.createElement('div')
  document.body.appendChild(container)
  const area = new WysiwygArea({ container })
  const element = area.getElement()
  const composition = trackComposition(element)

  const context: EditorContext = {
    composition,
    config: {},
    element,
    editingAreaManager: {
      getCurrentArea: () => area,
    } as unknown as EditingAreaManager,
  }

  const registry = new CommandRegistry(context)
  registerDefaultCommands(registry)
  registerModelCommands(registry, area.getStateHandle())
  context.commandRegistry = registry

  const pluginManager = new PluginManager(context)

  const selectAll = (): void => {
    const handle = area.getStateHandle()
    const state = handle.getState()!

    if (state.doc.content.size <= 2) return

    handle.dispatch(
      state.tr.setSelection(
        TextSelection.create(state.doc, 1, state.doc.content.size - 1)
      )
    )
  }

  const select = (from: number, to: number): void => {
    const handle = area.getStateHandle()
    const state = handle.getState()!

    handle.dispatch(
      state.tr.setSelection(TextSelection.create(state.doc, from, to))
    )
  }

  const collapse = (at = 1): void => {
    const handle = area.getStateHandle()
    const state = handle.getState()!

    handle.dispatch(
      state.tr.setSelection(TextSelection.create(state.doc, at))
    )
  }

  const load = (html: string): void => {
    area.setRawContent(html)
    selectAll()
  }

  load(initial)

  return {
    context,
    pluginManager,
    composition,
    registry,
    area,
    element,
    load,
    selectAll,
    collapse,
    select,
    html: () => area.getRawContent(),
    destroy: () => {
      area.destroy()
      container.remove()
    },
  }
}
