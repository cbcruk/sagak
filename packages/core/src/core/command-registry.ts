import { logger } from './logger'
import { CoreEvents } from './events'
import type { EventBus } from './event-bus'
import type { CompositionTracker } from './composition'

/**
 * 커맨드 실행 컨텍스트
 *
 * 핸들러가 현재 편집 상태에 접근할 수 있도록 필요한 서비스를 전달합니다.
 */
export interface CommandContext {
  eventBus: EventBus
  composition?: CompositionTracker
  element?: HTMLElement
}

/**
 * 커맨드 핸들러
 *
 * @returns 처리했으면 결과(`true`/`false`), 처리하지 않았으면 `undefined`
 *          (다음 precedence 핸들러로 위임)
 */
export type CommandHandler = (
  ctx: CommandContext,
  value?: string
) => boolean | undefined

/**
 * 커맨드 상태 조회 함수
 *
 * @returns 상태(`true`/`false`), 또는 판단하지 않으면 `undefined`
 */
export type CommandStateQuery = (ctx: CommandContext) => boolean | undefined

/**
 * 커맨드 값 조회 함수
 *
 * @returns 현재 값, 또는 판단하지 않으면 `undefined`
 */
export type CommandValueQuery = (ctx: CommandContext) => string | undefined

interface HandlerEntry {
  handler: CommandHandler
  prec: number
  seq: number
}

interface StateEntry {
  query: CommandStateQuery
  prec: number
  seq: number
}

interface ValueEntry {
  query: CommandValueQuery
  prec: number
  seq: number
}

/**
 * 커맨드 레지스트리
 *
 * 편집 커맨드를 이름으로 등록/실행하는 추상화 계층입니다. `document.execCommand`
 * 의존을 이 경계 안으로 격리하고, 커맨드별로 구현을 점진 교체할 수 있게 합니다.
 *
 * 하나의 커맨드에 여러 핸들러를 precedence 순으로 등록할 수 있습니다. 실행 시
 * 높은 precedence부터 시도하며, 처리하지 않은(`undefined`) 핸들러는 건너뜁니다.
 *
 * @example
 * ```typescript
 * registry.register('bold', (ctx) => document.execCommand('bold', false), -100)
 * registry.run('bold') // true/false
 * ```
 */
export class CommandRegistry {
  private handlers: Map<string, HandlerEntry[]> = new Map()
  private stateQueries: Map<string, StateEntry[]> = new Map()
  private valueQueries: Map<string, ValueEntry[]> = new Map()
  private context: CommandContext
  private seq = 0

  /**
   * @param context 핸들러에 전달할 컨텍스트 (라이브 참조 — 필드가 나중에
   *                갱신되면 실행 시점의 최신 값을 사용)
   */
  constructor(context: CommandContext) {
    this.context = context
  }

  /**
   * 지금 IME 조합 중인가 — 커맨드를 막을지 판단하는 자리입니다
   */
  isComposing(): boolean {
    return this.context.composition?.isComposing() ?? false
  }

  /**
   * 실행 컨텍스트를 교체합니다 (예: `element`/`composition` 변경 시)
   */
  setContext(context: CommandContext): void {
    this.context = context
  }

  /**
   * 커맨드 핸들러를 등록합니다
   *
   * @param name 커맨드 이름 (예: `'bold'`)
   * @param handler 핸들러 함수
   * @param prec precedence (높을수록 먼저 시도, 기본값 `0`)
   * @returns 등록 해제 함수
   */
  register(name: string, handler: CommandHandler, prec = 0): () => void {
    const entry: HandlerEntry = { handler, prec, seq: this.seq++ }
    const list = this.handlers.get(name) ?? []
    list.push(entry)
    // 높은 precedence 우선, 동일 precedence는 나중 등록이 우선
    list.sort((a, b) => b.prec - a.prec || b.seq - a.seq)
    this.handlers.set(name, list)

    return () => {
      const current = this.handlers.get(name)
      if (!current) return
      const next = current.filter((e) => e !== entry)
      if (next.length === 0) this.handlers.delete(name)
      else this.handlers.set(name, next)
    }
  }

  /**
   * 커맨드 상태 조회 함수를 등록합니다
   */
  registerStateQuery(
    name: string,
    query: CommandStateQuery,
    prec = 0
  ): () => void {
    const entry: StateEntry = { query, prec, seq: this.seq++ }
    const list = this.stateQueries.get(name) ?? []
    list.push(entry)
    list.sort((a, b) => b.prec - a.prec || b.seq - a.seq)
    this.stateQueries.set(name, list)

    return () => {
      const current = this.stateQueries.get(name)
      if (!current) return
      const next = current.filter((e) => e !== entry)
      if (next.length === 0) this.stateQueries.delete(name)
      else this.stateQueries.set(name, next)
    }
  }

  /**
   * 커맨드를 실행합니다
   *
   * precedence 순으로 핸들러를 시도하고, 처음으로 `undefined`가 아닌 결과를
   * 반환한 핸들러의 결과를 돌려줍니다.
   *
   * @param name 커맨드 이름
   * @param value 커맨드 값 (예: 색상, 폰트 크기)
   * @returns 커맨드 결과 (처리한 핸들러가 없으면 `false`)
   */
  run(name: string, value?: string): boolean {
    const list = this.handlers.get(name)
    if (!list) return false

    for (const { handler } of list) {
      const result = handler(this.context, value)
      if (result !== undefined) return result
    }

    return false
  }

  /**
   * 커맨드 값 조회 함수를 등록합니다
   */
  registerValueQuery(
    name: string,
    query: CommandValueQuery,
    prec = 0
  ): () => void {
    const entry: ValueEntry = { query, prec, seq: this.seq++ }
    const list = this.valueQueries.get(name) ?? []
    list.push(entry)
    list.sort((a, b) => b.prec - a.prec || b.seq - a.seq)
    this.valueQueries.set(name, list)

    return () => {
      const current = this.valueQueries.get(name)
      if (!current) return
      const next = current.filter((e) => e !== entry)
      if (next.length === 0) this.valueQueries.delete(name)
      else this.valueQueries.set(name, next)
    }
  }

  /**
   * 커맨드의 현재 값을 조회합니다
   *
   * @param name 커맨드 이름
   * @returns 현재 값 (판단한 조회 함수가 없으면 빈 문자열)
   */
  queryValue(name: string): string {
    const list = this.valueQueries.get(name)
    if (!list) return ''

    for (const { query } of list) {
      const result = query(this.context)
      if (result !== undefined) return result
    }

    return ''
  }

  /**
   * 커맨드의 활성 상태를 조회합니다
   *
   * @param name 커맨드 이름
   * @returns 활성 상태 (판단한 조회 함수가 없으면 `false`)
   */
  queryState(name: string): boolean {
    const list = this.stateQueries.get(name)
    if (!list) return false

    for (const { query } of list) {
      const result = query(this.context)
      if (result !== undefined) return result
    }

    return false
  }

  /**
   * 커맨드에 등록된 핸들러가 있는지 확인합니다
   */
  has(name: string): boolean {
    return this.handlers.has(name)
  }
}

/**
 * 커맨드를 부르는 **하나뿐인 문**입니다.
 *
 * 커맨드 하나를 돌릴 때마다 되풀이되는 규약 넷을 여기 한 자리에 담습니다.
 *
 * | | |
 * | --- | --- |
 * | 조합 중이면 막기 | 한글을 조립하는 중에 서식이 끼어들면 글자가 끊깁니다 |
 * | `CAPTURE_SNAPSHOT` | 되돌리기가 여기서 끊깁니다 |
 * | `STYLE_CHANGED` | 무엇이 바뀌었는지 알립니다 |
 * | `FOCUS_REQUESTED` | 툴바 버튼에 남은 포커스를 편집 영역으로 |
 *
 * ## 가드가 여기 있는 것이 요지입니다
 *
 * [`event-bus-refactor.md`](../../../../docs/event-bus-refactor.md) 가 센 것 —
 * `before` 단계 35개가 **전부 같은 IME 가드로 시작**했습니다. 레퍼런스
 * 에디터들이 IME 를 덜 다루는 게 아니라 **가드를 디스패치 경계 한 곳에**
 * 두는데, 이 저장소는 그 자리를 못 찾아 커맨드마다 복사했습니다.
 *
 * 그 자리가 여기입니다. 그 문서의 결론이 "버스를 교체하자" 가 아니라
 * **"가드를 제자리에 놓으면 단계가 남을 이유를 잃는다"** 였던 이유이기도
 * 합니다.
 */
export function runCommand(
  registry: CommandRegistry,
  eventBus: EventBus,
  name: string,
  value?: string
): boolean {
  if (registry.isComposing()) {
    logger.warn(`${name} blocked: IME composition in progress`)
    return false
  }

  eventBus.emit(CoreEvents.CAPTURE_SNAPSHOT)

  const result = registry.run(name, value)

  if (result) {
    eventBus.emit(CoreEvents.STYLE_CHANGED, { style: name, value })
    eventBus.emit(CoreEvents.FOCUS_REQUESTED)
  }

  return result
}
