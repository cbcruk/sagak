import type { EventBus } from './event-bus'
import type { CompositionTracker } from './composition'
import type { EditorContext, Plugin } from './types'
import { createErrorReporter, type ErrorReporter } from './errors'
import { runCommand } from './command-registry'
import type { CommandArgs, CommandName } from './command-map'
import { createDefaultCommandRegistry } from './default-commands'

/**
 * 플러그인 핸들러 컨텍스트
 *
 * 각 이벤트 핸들러에 전달되는 컨텍스트 객체
 */
export interface PluginHandlerContext<
  TOpts extends BasePluginOptions = BasePluginOptions,
  TState extends object = object,
> {
  /** 이벤트 버스 */
  eventBus: EventBus
  /**
   * 에디터 컨텍스트.
   *
   * 모델을 건드려야 하는 핸들러가 씁니다 (`runModelCommand(context, …)`).
   * 이름과 문자열 값 하나로 안 끝나는 일 — 표·이미지·특수문자 — 이 그렇습니다.
   */
  context: EditorContext
  /** 선택 영역 관리자 */
  composition?: CompositionTracker
  /** 플러그인 옵션 */
  options: TOpts
  /** 플러그인 상태 */
  state: TState
  /** 이벤트 발행 헬퍼 */
  emit: (event: string, data?: unknown) => boolean
  /**
   * 커맨드 실행 헬퍼
   *
   * `document.execCommand`를 직접 호출하는 대신 사용합니다. 히스토리 스냅샷
   * (`CAPTURE_SNAPSHOT`)을 발행한 뒤 커맨드 레지스트리로 실행을 위임합니다.
   *
   * @example
   * ```typescript
   * handlers: {
   *   BOLD_CLICKED: ({ runCommand, emit }) => {
   *     const result = runCommand('bold')
   *     if (result) emit(CoreEvents.STYLE_CHANGED, { style: 'bold' })
   *     return result
   *   }
   * }
   * ```
   */
  runCommand: <K extends CommandName>(
    name: K,
    ...args: CommandArgs<K>
  ) => boolean
  /** 커맨드 활성 상태 조회 헬퍼 */
  queryState: (name: string) => boolean
  /**
   * 오류 보고 헬퍼
   *
   * 오류를 기록하고 `CoreEvents.ERROR` 이벤트를 발행합니다.
   * 소스는 플러그인 이름으로 자동 지정됩니다.
   *
   * @example
   * ```typescript
   * handlers: {
   *   BOLD_CLICKED: ({ emit, reportError }) => {
   *     try { ... } catch (error) {
   *       reportError(error, 'Failed to execute command:')
   *       return false
   *     }
   *   }
   * }
   * ```
   */
  reportError: ErrorReporter
}

/**
 * 플러그인 초기화 컨텍스트
 *
 * `onInit` 훅에 전달되는 컨텍스트 객체
 */
export interface PluginInitContext<
  TOpts extends BasePluginOptions = BasePluginOptions,
  TState extends object = object,
> {
  /** 에디터 컨텍스트 */
  context: EditorContext
  /** 플러그인 옵션 */
  options: TOpts
  /** 플러그인 상태 */
  state: TState
  /**
   * DOM 이벤트 리스너 등록
   *
   * 등록된 리스너는 `destroy` 시 자동으로 제거됩니다
   */
  addDOMListener: <K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void
  ) => void
  /**
   * 커스텀 정리 함수 등록
   *
   * `destroy` 시 호출됩니다
   */
  addCleanup: (cleanup: () => void) => void
}

/**
 * 기본 플러그인 옵션
 */
export interface BasePluginOptions {
  /**
   * IME 입력 중 동작 차단 여부
   *
   * @deprecated **아무 효과가 없습니다.** 조합 가드가 플러그인마다 있던 것을
   * 모델에 닿는 경계 둘(`runCommand`·`runModelCommand`)로 모았습니다. 커맨드
   * 하나만 조합 중에 통과시킬 이유가 없어서 옵션도 안 남깁니다.
   */
  checkComposition?: boolean
}

/**
 * 이벤트 핸들러 타입
 *
 * 검증과 실행을 한 함수에서 처리합니다. `false`를 반환하면 이벤트가 취소되어
 * 이후 구독자에게 전달되지 않고 `emit`이 `false`를 반환합니다.
 *
 * IME 조합 가드는 `definePlugin`이 자동으로 걸어주므로 직접 검사하지 않습니다.
 */
export type PluginEventHandler<
  TOpts extends BasePluginOptions = BasePluginOptions,
  TState extends object = object,
> = (ctx: PluginHandlerContext<TOpts, TState>, data?: unknown) => boolean | void

/**
 * 플러그인 정의 객체
 */
export interface PluginDefinition<
  TOpts extends BasePluginOptions = BasePluginOptions,
  TState extends object = object,
> {
  /** 플러그인 이름 (예: `'text:bold'`) */
  name: string

  /**
   * IME 조합 중 차단될 때 로그에 표시할 이름 (예: `'Bold'`)
   *
   * @deprecated 가드가 경계로 옮겨가면서 로그도 커맨드 이름으로 남습니다.
   */
  compositionLabel?: string

  /** 플러그인 의존성 */
  dependencies?: string[]

  /** 기본 옵션 */
  defaultOptions?: Partial<TOpts>

  /**
   * 초기 상태 생성 함수
   *
   * 플러그인 인스턴스별로 독립적인 상태를 생성합니다
   */
  initialState?: () => TState

  /**
   * 이벤트 핸들러 맵
   *
   * 키: 이벤트 이름, 값: 핸들러 함수
   *
   * 함수로 전달하면 옵션에 따라 동적으로 이벤트 이름을 결정할 수 있습니다
   *
   * @example
   * ```typescript
   * // 고정 이벤트 이름
   * handlers: { 'BOLD_CLICKED': (ctx, data) => { ... } }
   *
   * // 옵션에 따라 동적 이벤트 이름
   * handlers: (options) => ({
   *   [options.eventName ?? 'BOLD_CLICKED']: (ctx, data) => { ... }
   * })
   * ```
   */
  handlers?:
    | Record<string, PluginEventHandler<TOpts, TState>>
    | ((options: TOpts) => Record<string, PluginEventHandler<TOpts, TState>>)

  /**
   * 초기화 훅
   *
   * DOM 리스너 등록 등 추가 초기화 작업에 사용합니다
   */
  onInit?: (ctx: PluginInitContext<TOpts, TState>) => void

  /**
   * 정리 훅
   *
   * 상태 정리 등 추가 정리 작업에 사용합니다
   */
  onDestroy?: (state: TState) => void

  /** 플러그인 버전 */
  version?: string
  /** 플러그인 작성자 */
  author?: string
  /** 플러그인 설명 */
  description?: string
}

/**
 * 플러그인 팩토리 함수 타입
 */
export type PluginFactory<TOpts extends BasePluginOptions = BasePluginOptions> =
  (options?: Partial<TOpts>) => Plugin

/**
 * 플러그인을 정의합니다
 *
 * 반복적인 boilerplate를 제거하고 선언적으로 플러그인을 정의할 수 있습니다
 *
 * @param definition - 플러그인 정의 객체
 * @returns 플러그인 팩토리 함수
 *
 * @example
 * ```typescript
 * const createBoldPlugin = definePlugin({
 *   name: 'text:bold',
 *   defaultOptions: { checkComposition: true },
 *   compositionLabel: 'Bold',
 *   handlers: {
 *     TOGGLE_BOLD: ({ emit, runCommand }) => {
 *       const result = runCommand('bold')
 *       if (result) emit('STYLE_CHANGED', { style: 'bold' })
 *       return result
 *     }
 *   }
 * })
 *
 * export const BoldPlugin = createBoldPlugin()
 * ```
 */
export function definePlugin<
  TOpts extends BasePluginOptions = BasePluginOptions,
  TState extends object = object,
>(definition: PluginDefinition<TOpts, TState>): PluginFactory<TOpts> {
  return (options?: Partial<TOpts>): Plugin => {
    const finalOptions = {
      checkComposition: true,
      ...definition.defaultOptions,
      ...options,
    } as TOpts

    const cleanups: Array<() => void> = []
    const state: TState = definition.initialState?.() ?? ({} as TState)

    return {
      name: definition.name,
      dependencies: definition.dependencies,
      version: definition.version,
      author: definition.author,
      description: definition.description,

      initialize(context: EditorContext) {
        const { eventBus, composition } = context

        const reportError = createErrorReporter(
          eventBus,
          `plugin:${definition.name}`
        )

        // EditorCore가 공유 레지스트리를 제공하지 않은 경우(예: 단독 사용/테스트)
        // 기본 커맨드 구성이 등록된 폴백 레지스트리를 생성합니다.
        const commandRegistry =
          context.commandRegistry ?? createDefaultCommandRegistry(context)

        const createHandlerContext = (): PluginHandlerContext<
          TOpts,
          TState
        > => ({
          eventBus,
          context,
          composition,
          options: finalOptions,
          state,
          emit: (event, data) => eventBus.emit(event, data),
          runCommand: (name, ...args) =>
            runCommand(commandRegistry, eventBus, name, ...args),
          queryState: (name) => commandRegistry.queryState(name),
          reportError,
        })

        if (definition.handlers) {
          const resolvedHandlers =
            typeof definition.handlers === 'function'
              ? definition.handlers(finalOptions)
              : definition.handlers

          /*
           * **조합 가드가 여기 없습니다.**
           *
           * 예전에는 핸들러마다 `before` 단계에 가드를 하나씩 걸었습니다.
           * 그 가드가 이제 **모델에 닿는 경계**에 있습니다 —
           * `runCommand`(이름과 값)와 `runModelCommand`(구조 있는 값) 둘입니다.
           *
           * 여기 두면 커맨드를 안 부르는 핸들러(다이얼로그 열기 등)까지 막고,
           * 무엇보다 같은 가드가 스물몇 벌이 됩니다 —
           * `docs/event-bus-refactor.md` 가 센 그 자리입니다.
           */
          for (const [eventName, handler] of Object.entries(resolvedHandlers)) {
            const unsub = eventBus.on(eventName, 'on', (data?: unknown) =>
              handler(createHandlerContext(), data)
            )
            cleanups.push(unsub)
          }
        }

        if (definition.onInit) {
          const initContext: PluginInitContext<TOpts, TState> = {
            context,
            options: finalOptions,
            state,
            addDOMListener: (element, type, listener) => {
              element.addEventListener(type, listener as EventListener)
              cleanups.push(() => {
                element.removeEventListener(type, listener as EventListener)
              })
            },
            addCleanup: (cleanup) => {
              cleanups.push(cleanup)
            },
          }
          definition.onInit(initContext)
        }
      },

      destroy() {
        if (definition.onDestroy) {
          definition.onDestroy(state)
        }

        cleanups.forEach((cleanup) => cleanup())
        cleanups.length = 0
      },
    }
  }
}
