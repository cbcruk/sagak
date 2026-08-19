import { logger } from '@/core/logger'
import { CoreEvents } from './events'
import type { EditorEventMap, KnownEventName, PayloadOf } from './event-map'

/**
 * 이벤트 핸들러 함수
 *
 * @returns `false`를 반환하면 후속 핸들러 실행을 중단합니다
 */
export type EventHandler = (...args: unknown[]) => boolean | void

/**
 * 이벤트 구독을 해제하는 함수
 */
export type Unsubscribe = () => void

/**
 * `EventBus` — 이벤트 기반 통신.
 *
 * ## 단계가 없어졌습니다
 *
 * `before`/`on`/`after` 셋이었습니다. [`event-bus-refactor.md`](../../../../docs/event-bus-refactor.md)
 * 가 처음 잰 것이 그 단계 모델이었고, 결론은 **거의 비어 있다** 였습니다 —
 * `after` 40개 중 35개가 빈 함수, `before` 35개가 전부 같은 IME 가드.
 *
 * 그 문서의 처방은 "버스를 교체하자" 가 아니라 **"가드를 제자리에 놓으면
 * 단계가 남을 이유를 잃는다"** 였습니다. 실제로 그렇게 됐습니다.
 *
 * ```
 * 가드를 커맨드 경계로        before 35 → 3
 * 서식이 커맨드가 됨          after      → 0
 * 남은 셋을 핸들러 앞머리로   before  3 → 0
 * ```
 *
 * 마지막 셋은 찾기/바꾸기의 값 검증이었고, 구독자가 하나뿐이라 "남보다 먼저"
 * 라는 단계의 값이 없었습니다 — 그냥 함수 첫머리입니다.
 *
 * @example
 * ```typescript
 * const bus = new EventBus()
 * const off = bus.on('FIND', (data) => { … })
 *
 * bus.emit('FIND', { query: '가나' })
 * off()
 * ```
 */
export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map()

  /**
   * 이벤트를 구독합니다
   *
   * @returns 구독 해제 함수
   */
  on<E extends KnownEventName>(
    event: E,
    handler: (payload: PayloadOf<E>) => boolean | void
  ): Unsubscribe
  on(event: string, handler: EventHandler): Unsubscribe
  on(event: string, handler: EventHandler): Unsubscribe {
    const set = this.handlers.get(event) ?? new Set<EventHandler>()

    set.add(handler)
    this.handlers.set(event, set)

    return () => this.off(event, handler)
  }

  /**
   * 이벤트 구독을 해제합니다
   */
  off(event: string, handler: EventHandler): void {
    const set = this.handlers.get(event)

    if (!set) return

    set.delete(handler)

    if (set.size === 0) this.handlers.delete(event)
  }

  /**
   * 이벤트를 발행합니다
   *
   * @returns 핸들러 중 하나라도 `false`를 반환하면 `false`
   */
  emit<E extends KnownEventName>(
    event: E,
    ...args: PayloadOf<E> extends void ? [] : [payload: PayloadOf<E>]
  ): boolean
  emit(event: string, ...args: unknown[]): boolean
  emit(event: string, ...args: unknown[]): boolean {
    const set = this.handlers.get(event)

    if (!set) return true

    for (const handler of set) {
      try {
        if (handler(...args) === false) return false
      } catch (error) {
        logger.error(`Error in event handler for "${event}":`, error)

        /*
         * 핸들러 오류를 `ERROR` 이벤트로 노출합니다. `ERROR` 자체의 핸들러
         * 오류는 재발행하지 않아 무한 루프를 막습니다.
         */
        if (event !== CoreEvents.ERROR) {
          this.emit(CoreEvents.ERROR, {
            source: `event-bus:${event}`,
            message: `Error in event handler for "${event}"`,
            error,
          })
        }
      }
    }

    return true
  }

  /**
   * 이 이벤트의 구독을 전부 해제합니다
   */
  clear(event: string): void {
    this.handlers.delete(event)
  }

  /**
   * 모든 구독을 해제합니다
   */
  clearAll(): void {
    this.handlers.clear()
  }

  /**
   * 구독자가 있는 이벤트 이름들 — 계약 검사가 씁니다
   */
  getEvents(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * 이 이벤트에 핸들러가 있습니까
   */
  hasHandlers(event: string): boolean {
    return (this.handlers.get(event)?.size ?? 0) > 0
  }
}

export type { EditorEventMap }
