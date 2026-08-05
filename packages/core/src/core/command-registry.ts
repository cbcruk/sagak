import { CoreEvents } from './events'
import type { EventBus } from './event-bus'
import type { SelectionManager } from './selection-manager'

/**
 * 커맨드 실행 컨텍스트
 *
 * 핸들러가 현재 편집 상태에 접근할 수 있도록 필요한 서비스를 전달합니다.
 */
export interface CommandContext {
  eventBus: EventBus
  selectionManager?: SelectionManager
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
   * 실행 컨텍스트를 교체합니다 (예: `element`/`selectionManager` 변경 시)
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
 * 스냅샷 캡처 후 커맨드를 실행하는 헬퍼
 *
 * 커맨드 실행 전후의 두 가지 규약을 여기 한 곳에 담습니다.
 *
 * - 실행 전 `CAPTURE_SNAPSHOT` — 히스토리가 직전 상태를 저장합니다.
 * - 성공 후 `FOCUS_REQUESTED` — 편집 영역으로 포커스를 되돌립니다.
 *   툴바 버튼을 누르면 포커스가 그 버튼에 남아, 커맨드는 저장된 선택 영역으로
 *   동작하지만 이어지는 타이핑이 편집 영역에 닿지 않습니다.
 *
 * 서식 플러그인이 `document.execCommand`를 직접 호출하던 자리를 대체합니다.
 *
 * @param registry 커맨드 레지스트리
 * @param eventBus 스냅샷·포커스 이벤트를 발행할 이벤트 버스
 * @param name 커맨드 이름
 * @param value 커맨드 값
 * @returns 커맨드 결과
 */
export function runCommand(
  registry: CommandRegistry,
  eventBus: EventBus,
  name: string,
  value?: string
): boolean {
  eventBus.emit(CoreEvents.CAPTURE_SNAPSHOT)
  const result = registry.run(name, value)

  if (result) {
    eventBus.emit(CoreEvents.FOCUS_REQUESTED)
  }

  return result
}
