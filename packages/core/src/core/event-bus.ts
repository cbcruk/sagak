/**
 * `EventBus` 생명주기의 이벤트 단계
 */
export type EventPhase = 'before' | 'on' | 'after'

/**
 * 이벤트 핸들러 함수
 *
 * @returns `false`를 반환하면 후속 핸들러 실행을 중단, `true` 또는 `void`를 반환하면 계속
 */
export type EventHandler = (...args: unknown[]) => boolean | void

/**
 * 이벤트 구독을 해제하는 함수
 */
export type Unsubscribe = () => void

/**
 * `EventBus` - 이벤트 기반 통신 시스템
 *
 * 세 단계 이벤트 생명주기를 지원합니다:
 * - `BEFORE`: 사전 처리, 이벤트를 취소할 수 있음
 * - `ON`: 주요 처리
 * - `AFTER`: 사후 처리
 *
 * @example
 * ```typescript
 * const bus = new EventBus();
 *
 * // Subscribe to an event
 * const unsubscribe = bus.on('BOLD_CLICKED', 'on', () => {
 *   document.execCommand('bold');
 * });
 *
 * // Emit an event
 * bus.emit('BOLD_CLICKED');
 *
 * // Unsubscribe
 * unsubscribe();
 * ```
 */
export class EventBus {
  private handlers: Map<string, Map<EventPhase, Set<EventHandler>>> = new Map()

  /**
   * 이벤트를 구독합니다
   *
   * @param event 이벤트 이름
   * @param phase 이벤트 단계 (`before`, `on`, `after`)
   * @param handler 이벤트 핸들러 함수
   * @returns 구독 해제 함수
   *
   * @example
   * ```typescript
   * const unsubscribe = bus.on('APP_READY', 'before', () => {
   *   console.log('App is preparing...');
   * });
   * ```
   */
  on(event: string, phase: EventPhase, handler: EventHandler): Unsubscribe {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Map())
    }

    const eventHandlers = this.handlers.get(event)!

    if (!eventHandlers.has(phase)) {
      eventHandlers.set(phase, new Set())
    }

    const phaseHandlers = eventHandlers.get(phase)!

    phaseHandlers.add(handler)

    return () => this.off(event, phase, handler)
  }

  /**
   * 이벤트 구독을 해제합니다
   *
   * @param event 이벤트 이름
   * @param phase 이벤트 단계
   * @param handler 제거할 이벤트 핸들러
   */
  off(event: string, phase: EventPhase, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(event)

    if (!eventHandlers) return

    const phaseHandlers = eventHandlers.get(phase)

    if (!phaseHandlers) return

    phaseHandlers.delete(handler)

    if (phaseHandlers.size === 0) {
      eventHandlers.delete(phase)
    }

    if (eventHandlers.size === 0) {
      this.handlers.delete(event)
    }
  }

  /**
   * 이벤트를 발행합니다
   *
   * 핸들러를 순서대로 실행합니다: `BEFORE` → `ON` → `AFTER`
   * `BEFORE` 또는 `ON` 단계의 핸들러가 `false`를 반환하면 체인이 중단됩니다.
   * `AFTER` 단계는 이벤트를 취소할 수 없습니다 (항상 계속됨).
   *
   * @param event 이벤트 이름
   * @param args 핸들러에 전달할 인자
   * @returns 모든 핸들러가 실행되면 `true`, `BEFORE` 또는 `ON` 단계에서 취소되면 `false`
   *
   * @example
   * ```typescript
   * // Cancel event in BEFORE phase
   * bus.on('SAVE', 'before', () => {
   *   if (!isValid()) return false; // Cancel
   * });
   *
   * const result = bus.emit('SAVE'); // false if cancelled
   * ```
   */
  emit(event: string, ...args: unknown[]): boolean {
    if (!this.execPhase(event, 'before', args)) {
      return false
    }

    if (!this.execPhase(event, 'on', args)) {
      return false
    }

    this.execPhase(event, 'after', args)

    return true
  }

  /**
   * 특정 단계의 모든 핸들러를 실행합니다
   *
   * @param event 이벤트 이름
   * @param phase 이벤트 단계
   * @param args 핸들러에 전달할 인자
   * @returns 핸들러가 `false`를 반환하면 `false`, 그렇지 않으면 `true`
   */
  private execPhase(
    event: string,
    phase: EventPhase,
    args: unknown[]
  ): boolean {
    const eventHandlers = this.handlers.get(event)

    if (!eventHandlers) return true

    const phaseHandlers = eventHandlers.get(phase)

    if (!phaseHandlers) return true

    for (const handler of phaseHandlers) {
      try {
        const result = handler(...args)
        if (result === false) {
          return false
        }
      } catch (error) {
        console.error(
          `Error in event handler for "${event}" (${phase} phase):`,
          error
        )
      }
    }

    return true
  }

  /**
   * 이벤트의 모든 핸들러를 제거합니다
   *
   * @param event 이벤트 이름
   */
  clear(event: string): void {
    this.handlers.delete(event)
  }

  /**
   * 모든 이벤트의 모든 핸들러를 제거합니다
   */
  clearAll(): void {
    this.handlers.clear()
  }

  /**
   * 등록된 모든 이벤트를 가져옵니다
   *
   * @returns 이벤트 이름 배열
   */
  getEvents(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * 이벤트에 핸들러가 있는지 확인합니다
   *
   * @param event 이벤트 이름
   * @param phase 확인할 선택적 단계
   * @returns 핸들러가 존재하면 `true`
   */
  hasHandlers(event: string, phase?: EventPhase): boolean {
    const eventHandlers = this.handlers.get(event)

    if (!eventHandlers) return false

    if (phase) {
      const phaseHandlers = eventHandlers.get(phase)

      return phaseHandlers ? phaseHandlers.size > 0 : false
    }

    for (const phaseHandlers of eventHandlers.values()) {
      if (phaseHandlers.size > 0) return true
    }

    return false
  }
}
