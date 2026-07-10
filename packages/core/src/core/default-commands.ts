import { CommandRegistry, type CommandContext } from './command-registry'
import { registerLegacyExecCommands } from './legacy-exec-command'
import { registerNativeAlignment } from './commands/native-alignment'

/**
 * 기본 커맨드 구성을 레지스트리에 등록합니다
 *
 * - 레거시 `execCommand` 어댑터 (최저 precedence, 전체 명령 폴백)
 * - 자체 구현 커맨드 (더 높은 precedence로 레거시를 대체)
 *   - 정렬: `justifyLeft/Center/Right/Full`
 *
 * @param registry 커맨드 레지스트리
 * @returns 모든 등록을 해제하는 함수
 */
export function registerDefaultCommands(registry: CommandRegistry): () => void {
  const unsubLegacy = registerLegacyExecCommands(registry)
  const unsubAlignment = registerNativeAlignment(registry)

  return () => {
    unsubAlignment()
    unsubLegacy()
  }
}

/**
 * 기본 커맨드 구성이 등록된 레지스트리를 생성합니다
 *
 * `EditorCore` 없이 플러그인을 단독 사용할 때의 폴백으로 사용됩니다.
 */
export function createDefaultCommandRegistry(
  context: CommandContext
): CommandRegistry {
  const registry = new CommandRegistry(context)
  registerDefaultCommands(registry)
  return registry
}
