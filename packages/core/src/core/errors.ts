import { logger } from './logger'

/**
 * 에디터 오류
 */
export interface EditorErrorData {
  /**
   * 오류 발생 위치
   *
   * @example 'plugin:utility:auto-save', 'wysiwyg-area'
   */
  source: string

  /**
   * 사람이 읽을 수 있는 오류 메시지
   */
  message: string

  /**
   * 원본 오류 객체
   */
  error: unknown
}

/**
 * 오류를 받는 곳 — `createEditor` 의 `onError` 입니다.
 *
 * 예전에는 `CoreEvents.ERROR` 를 버스에 쏘고 `EditorCore` 가 그것을 받아
 * `onError` 로 넘겼습니다. **코어가 쏘고 코어가 받는 왕복**이었고, 버스에
 * 마지막까지 남아 있던 이유였습니다.
 */
export type ErrorSink = (data: EditorErrorData) => void

/**
 * 오류를 보고하는 함수
 */
export type ErrorReporter = (error: unknown, message: string) => void

/**
 * 특정 소스에 대한 오류 보고 함수를 만듭니다.
 *
 * 언제나 `logger.error(message, error)` 로 기록하고, 받는 곳이 있으면 거기에도
 * 넘깁니다. 받는 곳이 없어도 로그는 남습니다 — 그래서 `sink` 는 선택입니다.
 *
 * @example
 * ```typescript
 * const report = createErrorReporter(context.onError, 'plugin:utility:auto-save')
 *
 * try {
 *   // ...
 * } catch (error) {
 *   report(error, 'Failed to save:')
 * }
 * ```
 */
export function createErrorReporter(
  sink: ErrorSink | undefined,
  source: string
): ErrorReporter {
  return (error: unknown, message: string): void => {
    logger.error(message, error)
    sink?.({ source, message, error })
  }
}
