import type { EventBus, EventPhase } from './event-bus'
import type { SelectionManager } from './selection-manager'
import type { EditorContext, Plugin } from './types'
import { createErrorReporter, type ErrorReporter } from './errors'
import { CommandRegistry, runCommand } from './command-registry'
import { registerLegacyExecCommands } from './legacy-exec-command'

/**
 * 공유 레지스트리가 없을 때 사용할 폴백 커맨드 레지스트리를 생성합니다
 * (레거시 execCommand 어댑터 등록 포함)
 */
function createFallbackRegistry(context: EditorContext): CommandRegistry {
  const registry = new CommandRegistry(context)
  registerLegacyExecCommands(registry)
  return registry
}

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
  /** 선택 영역 관리자 */
  selectionManager?: SelectionManager
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
   * on: ({ runCommand, emit }) => {
   *   const result = runCommand('bold')
   *   if (result) emit(CoreEvents.STYLE_CHANGED, { style: 'bold' })
   *   return result
   * }
   * ```
   */
  runCommand: (name: string, value?: string) => boolean
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
   * on: ({ emit, reportError }) => {
   *   try { ... } catch (error) {
   *     reportError(error, 'Failed to execute command:')
   *     return false
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
  /** IME 입력 중 동작 차단 여부 (기본값: `true`) */
  checkComposition?: boolean
}

/**
 * 이벤트 핸들러 타입
 */
export type PluginEventHandler<
  TOpts extends BasePluginOptions = BasePluginOptions,
  TState extends object = object,
> = (ctx: PluginHandlerContext<TOpts, TState>, data?: unknown) => boolean | void

/**
 * 이벤트별 핸들러 정의
 */
export interface PluginEventHandlers<
  TOpts extends BasePluginOptions = BasePluginOptions,
  TState extends object = object,
> {
  /** `before` 단계 핸들러 - 검증 및 취소 가능 */
  before?: PluginEventHandler<TOpts, TState>
  /** `on` 단계 핸들러 - 메인 로직 */
  on?: PluginEventHandler<TOpts, TState>
  /** `after` 단계 핸들러 - 후처리 */
  after?: PluginEventHandler<TOpts, TState>
}

/**
 * 플러그인 정의 객체
 */
export interface PluginDefinition<
  TOpts extends BasePluginOptions = BasePluginOptions,
  TState extends object = object,
> {
  /** 플러그인 이름 (예: `'text:bold'`) */
  name: string

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
   * 키: 이벤트 이름, 값: `before`/`on`/`after` 핸들러
   *
   * 함수로 전달하면 옵션에 따라 동적으로 이벤트 이름을 결정할 수 있습니다
   *
   * @example
   * ```typescript
   * // 고정 이벤트 이름
   * handlers: { 'BOLD_CLICKED': { on: ... } }
   *
   * // 옵션에 따라 동적 이벤트 이름
   * handlers: (options) => ({
   *   [options.eventName ?? 'BOLD_CLICKED']: { on: ... }
   * })
   * ```
   */
  handlers?:
    | Record<string, PluginEventHandlers<TOpts, TState>>
    | ((options: TOpts) => Record<string, PluginEventHandlers<TOpts, TState>>)

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
 *   handlers: {
 *     TOGGLE_BOLD: {
 *       before: ({ selectionManager, options }) =>
 *         !(options.checkComposition && selectionManager?.getIsComposing()),
 *       on: ({ emit }) => {
 *         const result = document.execCommand('bold')
 *         if (result) emit('STYLE_CHANGED', { style: 'bold' })
 *         return result
 *       }
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
        const { eventBus, selectionManager } = context

        const reportError = createErrorReporter(
          eventBus,
          `plugin:${definition.name}`
        )

        // EditorCore가 공유 레지스트리를 제공하지 않은 경우(예: 단독 사용/테스트)
        // 레거시 execCommand 어댑터가 등록된 폴백 레지스트리를 생성합니다.
        const commandRegistry =
          context.commandRegistry ?? createFallbackRegistry(context)

        const createHandlerContext = (): PluginHandlerContext<
          TOpts,
          TState
        > => ({
          eventBus,
          selectionManager,
          options: finalOptions,
          state,
          emit: (event, data) => eventBus.emit(event, data),
          runCommand: (name, value) =>
            runCommand(commandRegistry, eventBus, name, value),
          queryState: (name) => commandRegistry.queryState(name),
          reportError,
        })

        if (definition.handlers) {
          const resolvedHandlers =
            typeof definition.handlers === 'function'
              ? definition.handlers(finalOptions)
              : definition.handlers

          for (const [eventName, phases] of Object.entries(resolvedHandlers)) {
            const phaseOrder: EventPhase[] = ['before', 'on', 'after']

            for (const phase of phaseOrder) {
              const handler = phases[phase]
              if (!handler) continue

              const unsub = eventBus.on(eventName, phase, (data?: unknown) => {
                return handler(createHandlerContext(), data)
              })
              cleanups.push(unsub)
            }
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
