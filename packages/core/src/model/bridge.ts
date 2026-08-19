import { undoDepth, redoDepth } from 'prosemirror-history'
import type { EditorState, Transaction } from 'prosemirror-state'
import type { EditorContext } from '@/core/types'
import { EditingAreaEvents } from '@/core/events'
import { logger } from '@/core/logger'
import type { StateHandle } from './register'
import type { Command } from './commands'
import {
  alignmentAt,
  imageFactsAt,
  isCaretInTable,
  linkAt,
  listKindAt,
  type Alignment,
  type ImageFacts,
  type LinkFacts,
  type ListKind,
} from './selection'

/**
 * 플러그인이 **모델에 닿는 하나뿐인 문**입니다.
 *
 * 커맨드 레지스트리는 이름과 문자열 값 하나만 주고받습니다(`bold`,
 * `fontName: 'Georgia'`). 표나 이미지처럼 **여러 값을 함께 넘겨야 하는 일**은
 * 그 서명에 안 들어가서, 그런 플러그인은 상태를 직접 받아 트랜잭션을 보냅니다.
 *
 * `undefined` 를 돌려주는 경우가 있습니다 — 소스·텍스트 모드에는 모델이 없고,
 * 그때는 표를 넣을 자리도 없습니다.
 */
export function modelHandle(context: EditorContext): StateHandle | undefined {
  return context.editingAreaManager?.getCurrentArea()?.getStateHandle?.()
}

/**
 * 모델 커맨드를 지금 편집 영역에서 돌립니다.
 *
 * 모델이 없으면 `false` — "할 수 없었다" 입니다.
 */
export function runModelCommand(
  context: EditorContext,
  command: Command
): boolean {
  /*
   * **조합 중이면 막습니다.**
   *
   * 이름과 값 하나로 끝나는 커맨드는 `runCommand` 가 경계에서 막습니다
   * (`core/command-registry.ts`). 표·이미지처럼 여러 값을 넘겨야 해서 이쪽으로
   * 오는 것들도 같은 가드를 지나야 합니다 — **모델에 닿는 모든 길**에 있어야
   * 가드가 한 개념입니다.
   */
  if (context.composition?.isComposing()) {
    logger.warn('Command blocked: IME composition in progress')
    return false
  }

  const handle = modelHandle(context)
  const state = handle?.getState()

  if (!handle || !state) {
    return false
  }

  return command(state, handle.dispatch)
}

/** 상태만 읽습니다 — 지금 캐럿이 표 안인지 같은 것을 물을 때 */
export function modelState(context: EditorContext) {
  return modelHandle(context)?.getState() ?? null
}

/**
 * 상태가 바뀔 때 부릅니다.
 *
 * `tr` 이 `null` 인 경우가 있습니다 — 문서를 통째로 갈아 끼워 트랜잭션이
 * 아니라 새 상태가 들어온 것입니다 (문서를 열거나 모드를 오간 것).
 */
export type ModelListener = (state: EditorState, tr: Transaction | null) => void

/**
 * 편집 영역의 상태 변화를 구독합니다 — **모드가 바뀌어도 끊기지 않습니다.**
 *
 * 영역은 모드마다 다른 물건이고, 소스·텍스트 모드에는 모델이 아예 없습니다.
 * 부르는 쪽이 그 사정을 알 필요가 없도록 여기서 다시 붙입니다.
 *
 * 모델이 없는 모드에서는 아무 일도 안 일어납니다 — 구독은 살아 있고, WYSIWYG
 * 로 돌아오면 다시 흐릅니다.
 */
export function subscribeToModel(
  context: EditorContext,
  listener: ModelListener
): () => void {
  let detach: (() => void) | undefined

  const attach = (): void => {
    detach?.()
    detach = context.editingAreaManager
      ?.getCurrentArea()
      ?.subscribe?.(listener)
  }

  attach()

  const unsubMode = context.eventBus.on(
    EditingAreaEvents.EDITING_AREA_MODE_CHANGED, attach
  )

  return () => {
    detach?.()
    detach = undefined
    unsubMode()
  }
}

/**
 * 툴바가 묻는 것들 — **모델이 없으면 기본값**입니다.
 *
 * 소스·텍스트 모드에서는 물을 문서가 없습니다. 그때 던지거나 `undefined` 를
 * 주는 대신 "아무것도 아님" 을 돌려줍니다 — 툴바는 계속 그려져야 합니다.
 */
export function selectionFacts(context: EditorContext): {
  alignment: Alignment
  list: ListKind
  inTable: boolean
  link: LinkFacts | null
  image: ImageFacts | null
} {
  const state = modelState(context)

  if (!state) {
    return {
      alignment: 'left',
      list: 'none',
      inTable: false,
      link: null,
      image: null,
    }
  }

  return {
    alignment: alignmentAt(state),
    list: listKindAt(state),
    inTable: isCaretInTable(state),
    link: linkAt(state),
    image: imageFactsAt(state),
  }
}

/** 낱개로 묻는 자리들 — 위 묶음과 같은 답을 줍니다 */
export const alignmentOf = (context: EditorContext): Alignment =>
  selectionFacts(context).alignment

export const listKindOf = (context: EditorContext): ListKind =>
  selectionFacts(context).list

export const isInTableOf = (context: EditorContext): boolean =>
  selectionFacts(context).inTable

export const linkOf = (context: EditorContext): LinkFacts | null =>
  selectionFacts(context).link

export const imageOf = (context: EditorContext): ImageFacts | null =>
  selectionFacts(context).image

/**
 * 되돌릴 것이 남아 있는가 — **문서 상태에서 바로 읽습니다.**
 *
 * 예전에는 편집 영역이 `HISTORY_STATE_CHANGED` 를 쏘고 툴바가 받았습니다.
 * 버스에는 "지금 값" 이 없어서 툴바가 늦게 붙으면 둘 다 꺼진 채로 시작했고,
 * 그걸 메우려고 각자 처음 값을 따로 물어야 했습니다.
 *
 * 깊이는 상태 안에 있습니다. 언제 묻든 지금 값입니다.
 */
export function historyDepthOf(context: EditorContext): {
  canUndo: boolean
  canRedo: boolean
  undoSize: number
  redoSize: number
} {
  const state = modelState(context)

  if (!state) {
    return { canUndo: false, canRedo: false, undoSize: 0, redoSize: 0 }
  }

  const undoSize = undoDepth(state)
  const redoSize = redoDepth(state)

  return { canUndo: undoSize > 0, canRedo: redoSize > 0, undoSize, redoSize }
}
