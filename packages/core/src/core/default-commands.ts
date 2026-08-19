import { CommandRegistry, type CommandContext } from './command-registry'
import { registerComputedQueries } from './commands/computed-query'

/**
 * 기본 커맨드 구성 옵션
 */
export interface DefaultCommandsOptions {
  /**
   * 레거시 `execCommand` 폴백 어댑터 등록 여부
   *
   * @deprecated **아무 데도 안 쓰입니다.** 서식은 전부 문서 모델 위에서
   * 돌고(`src/model/register.ts`), 그 층이 늘 먼저 답해서 아래에 있던
   * `execCommand` 어댑터는 **한 번도 안 잡혔습니다.** 재고 지웠습니다
   * (`test/model/command-layers.browser.test.ts`).
   */
  legacyFallback?: boolean
}

/**
 * 기본 커맨드 구성을 레지스트리에 등록합니다.
 *
 * ## 여기 있던 것들이 어디로 갔나
 *
 * 예전에는 이 함수가 여덟 뭉치를 등록했습니다 — 정렬·블록 포맷·인라인 토글·
 * 인라인 스타일·목록·글꼴 크기·조회, 그리고 최하위에 `execCommand` 어댑터.
 * `contentEditable` 을 손으로 다루는 코드였고, 그게 이 저장소에서 제일 미묘한
 * 부분이었습니다.
 *
 * 편집 영역이 문서 모델을 갖게 되면서 그 전부가 **더 높은 precedence 에서
 * 가로채집니다.** 재 보니 `document.execCommand` 호출이 **0** 이었습니다.
 *
 * 남은 것은 하나입니다 — 문서에 없고 화면에만 있는 값(계산된 글꼴·크기).
 * 그건 모델이 답할 수 없어서 모델이 `undefined` 를 주고 여기로 넘어옵니다.
 *
 * @param registry 커맨드 레지스트리
 * @returns 모든 등록을 해제하는 함수
 */
export function registerDefaultCommands(
  registry: CommandRegistry,
  _options: DefaultCommandsOptions = {}
): () => void {
  return registerComputedQueries(registry)
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
