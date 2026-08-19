import type { EditorContext } from '@/core/types'
import type { StateHandle } from './register'
import type { Command } from './commands'

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
