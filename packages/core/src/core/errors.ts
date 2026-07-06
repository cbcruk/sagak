import { logger } from './logger'
import { CoreEvents } from './events'
import type { EventBus } from './event-bus'

/**
 * 에디터 오류 이벤트 페이로드
 *
 * `CoreEvents.ERROR` 이벤트와 함께 전달됩니다.
 */
export interface EditorErrorData {
  /**
   * 오류 발생 위치
   *
   * @example 'plugin:text-style:bold', 'selection-manager', 'event-bus'
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
 * 오류를 보고하는 함수
 *
 * `logger.error`로 기록하고 `CoreEvents.ERROR` 이벤트를 발행합니다.
 */
export type ErrorReporter = (error: unknown, message: string) => void

/**
 * 특정 소스에 대한 오류 보고 함수를 생성합니다
 *
 * 반환된 함수는 오류를 `logger.error(message, error)` 형태로 기록하고
 * (기존 로깅 동작 유지), 동시에 `CoreEvents.ERROR` 이벤트를 발행하여
 * 소비자가 오류를 구독할 수 있게 합니다.
 *
 * @param eventBus - 오류 이벤트를 발행할 `EventBus`
 * @param source - 오류 발생 위치 식별자
 * @returns 오류 보고 함수
 *
 * @example
 * ```typescript
 * const report = createErrorReporter(eventBus, 'plugin:text-style:bold')
 * try {
 *   // ...
 * } catch (error) {
 *   report(error, 'Failed to execute bold command:')
 * }
 * ```
 */
export function createErrorReporter(
  eventBus: EventBus,
  source: string
): ErrorReporter {
  return (error: unknown, message: string): void => {
    logger.error(message, error)
    eventBus.emit(CoreEvents.ERROR, { source, message, error })
  }
}
