import type { CommandRegistry } from './command-registry'

/**
 * `document.execCommand`에 위임하는 커맨드 이름 목록
 *
 * 서식 플러그인이 사용하는 모든 네이티브 명령을 포함합니다.
 */
const EXEC_COMMANDS = [
  'bold',
  'italic',
  'underline',
  'strikeThrough',
  'subscript',
  'superscript',
  'foreColor',
  'backColor',
  'fontName',
  'fontSize',
  'formatBlock',
  'insertOrderedList',
  'insertUnorderedList',
  'indent',
  'outdent',
  'justifyLeft',
  'justifyCenter',
  'justifyRight',
  'justifyFull',
  'createLink',
  'unlink',
] as const

/**
 * `document.queryCommandState`에 위임하는 상태 조회 커맨드 목록
 */
const STATE_COMMANDS = [
  'bold',
  'italic',
  'underline',
  'strikeThrough',
  'subscript',
  'superscript',
] as const

/**
 * 레거시 `execCommand` 어댑터의 precedence
 *
 * 가장 낮게 두어, 커맨드별 자체 구현이 등록되면 그쪽이 우선하도록 합니다.
 */
export const LEGACY_PRECEDENCE = -100

/**
 * 모든 서식 커맨드를 `document.execCommand`/`queryCommandState`에 위임하는
 * 핸들러를 레지스트리에 등록합니다
 *
 * 커맨드 추상화 도입 1단계로, 동작·마크업을 바꾸지 않고 `execCommand` 의존을
 * 레지스트리 경계 안으로 격리합니다. 이후 커맨드를 하나씩 더 높은 precedence의
 * 자체 구현으로 교체할 수 있습니다.
 *
 * @param registry 커맨드 레지스트리
 * @returns 모든 등록을 해제하는 함수
 */
export function registerLegacyExecCommands(
  registry: CommandRegistry
): () => void {
  const unsubs: Array<() => void> = []

  for (const name of EXEC_COMMANDS) {
    unsubs.push(
      registry.register(
        name,
        (_ctx, value) =>
          value === undefined
            ? document.execCommand(name, false)
            : document.execCommand(name, false, value),
        LEGACY_PRECEDENCE
      )
    )
  }

  for (const name of STATE_COMMANDS) {
    unsubs.push(
      registry.registerStateQuery(
        name,
        () => document.queryCommandState(name),
        LEGACY_PRECEDENCE
      )
    )
  }

  return () => {
    for (const unsub of unsubs) unsub()
  }
}
