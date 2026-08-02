import { CommandRegistry, type CommandContext } from './command-registry'
import { registerLegacyExecCommands } from './legacy-exec-command'
import { registerNativeAlignment } from './commands/native-alignment'
import { registerNativeFormatBlock } from './commands/native-format-block'
import { registerNativeInlineToggles } from './commands/native-inline-toggles'
import { registerNativeInlineStyles } from './commands/native-inline-styles'
import { registerNativeList } from './commands/native-list'
import { registerNativeFontSize } from './commands/native-font-size'
import { registerNativeQueries } from './commands/native-query'

/**
 * 기본 커맨드 구성 옵션
 */
export interface DefaultCommandsOptions {
  /**
   * 레거시 `execCommand` 폴백 어댑터 등록 여부 (기본값: `true`)
   *
   * 자체 구현이 판단할 수 없는 상황(선택 없음, 편집 호스트 밖, 변환 불가
   * 구조 등)에서 브라우저 기본 동작으로 위임하는 **안전망**입니다.
   *
   * `false`로 두면 deprecated된 `execCommand`/`queryCommand*`를 전혀
   * 호출하지 않습니다. 대신 판단 불가 상황에서 커맨드가 아무 동작도 하지
   * 않고 `false`를 반환합니다.
   */
  legacyFallback?: boolean
}

/**
 * 기본 커맨드 구성을 레지스트리에 등록합니다
 *
 * - 자체 구현 커맨드
 *   - 정렬: `justifyLeft/Center/Right/Full`
 *   - 블록 포맷: `formatBlock` (`p`, `h1`~`h6`, `blockquote` 등)
 *   - 인라인 토글: `bold/italic/underline/strikeThrough/subscript/superscript`
 *     (collapsed 커서는 보류 서식 상태가 담당)
 *   - 인라인 스타일: `foreColor/backColor/fontName` + 링크 `createLink/unlink`
 *   - 리스트·들여쓰기: `insertOrderedList/insertUnorderedList/indent/outdent`
 *   - 글꼴 크기: `fontSize` (1–7 스케일 API 유지, CSS로 렌더링)
 *   - 상태·값 조회: 토글 6종 상태, `fontName`/`fontSize` 값
 * - 레거시 `execCommand` 어댑터 (최저 precedence 폴백, `legacyFallback`으로 해제 가능)
 *
 * @param registry 커맨드 레지스트리
 * @param options 구성 옵션
 * @returns 모든 등록을 해제하는 함수
 */
export function registerDefaultCommands(
  registry: CommandRegistry,
  options: DefaultCommandsOptions = {}
): () => void {
  const unsubLegacy =
    options.legacyFallback === false
      ? () => {}
      : registerLegacyExecCommands(registry)
  const unsubAlignment = registerNativeAlignment(registry)
  const unsubFormatBlock = registerNativeFormatBlock(registry)
  const unsubInlineToggles = registerNativeInlineToggles(registry)
  const unsubInlineStyles = registerNativeInlineStyles(registry)
  const unsubList = registerNativeList(registry)
  const unsubFontSize = registerNativeFontSize(registry)
  const unsubQueries = registerNativeQueries(registry)

  return () => {
    unsubQueries()
    unsubFontSize()
    unsubList()
    unsubInlineStyles()
    unsubInlineToggles()
    unsubFormatBlock()
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
  context: CommandContext,
  options: DefaultCommandsOptions = {}
): CommandRegistry {
  const registry = new CommandRegistry(context)
  registerDefaultCommands(registry, options)
  return registry
}
