import { runCommand } from 'sagak-core'
import type { CommandArgs, CommandName, EditorContext } from 'sagak-core'

/**
 * 툴바가 **커맨드를 부르는 하나뿐인 길**입니다.
 *
 * ## 층이 둘이었습니다
 *
 * 예전에는 이렇게 갔습니다.
 *
 * ```
 * 툴바 --BOLD_CLICKED--> 버스 --> 플러그인 --run('bold')--> 레지스트리 --> 모델
 * ```
 *
 * **이름으로 핸들러를 찾는 일을 두 번** 했고, 그 사이 플러그인이 하던 일은
 * 검증하고 넘기는 것이 전부였습니다 (25개 중 21개).
 *
 * 이제 한 번입니다. 가드와 알림은 `runCommand` 가 경계에서 챙깁니다 —
 * 조합 중 막기, `CAPTURE_SNAPSHOT`, `STYLE_CHANGED`, 포커스 되돌리기.
 *
 * ## 이름이 틀리면 컴파일러가 잡습니다
 *
 * 버스는 문자열이라 오타가 조용히 아무 일도 안 하는 것이 됐습니다
 * (`event-contract.browser.test.ts` 가 그걸 잡으려고 있었습니다). 커맨드
 * 맵을 지나면 이름도 값의 모양도 타입입니다.
 */
export function exec<K extends CommandName>(
  editor: EditorContext,
  name: K,
  ...args: CommandArgs<K>
): boolean {
  const registry = editor.commandRegistry

  if (!registry) return false

  return runCommand(registry, editor.eventBus, name, ...args)
}
