import { definePlugin, ParagraphEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 제목 수준 타입 (1-6)
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/**
 * 제목 플러그인 설정 옵션
 */
export interface HeadingPluginOptions extends BasePluginOptions {
  /**
   * 제목 명령을 수신할 이벤트 이름
   * @default 'HEADING_CHANGED'
   */
  eventName?: string

  /**
   * 허용된 제목 수준 목록 (선택적 검증)
   * 제공된 경우 이 수준만 허용됩니다
   */
  allowedLevels?: HeadingLevel[]

  /**
   * 허용되는 최소 제목 수준
   * @default 1
   */
  minLevel?: HeadingLevel

  /**
   * 허용되는 최대 제목 수준
   * @default 6
   */
  maxLevel?: HeadingLevel
}

/**
 * 제목 수준을 검증합니다
 *
 * @param level - 검증할 수준
 * @returns 유효한 제목 수준인 경우 `true`
 */
function isValidHeadingLevel(level: unknown): level is HeadingLevel {
  return (
    typeof level === 'number' &&
    Number.isInteger(level) &&
    level >= 1 &&
    level <= 6
  )
}

/**
 * 이벤트 데이터에서 제목 수준을 추출합니다
 * `{ level: 1 }` 및 직접 숫자 형식을 모두 처리합니다
 *
 * @param data - 이벤트 데이터
 * @returns 제목 수준 또는 `null`
 */
function extractHeadingLevel(data: unknown): unknown {
  if (data === undefined || data === null) {
    return null
  }

  if (typeof data === 'object' && data !== null && 'level' in data) {
    return (data as { level: unknown }).level
  }

  return data
}

/**
 * 제목 플러그인 인스턴스를 생성합니다
 *
 * 네이티브 `execCommand` API를 사용하여 단락에 제목 형식을 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const headingPlugin = createHeadingPlugin({
 *   eventName: 'HEADING_CHANGED',
 *   checkComposition: true,
 *   allowedLevels: [1, 2, 3]
 * });
 *
 * await pluginManager.register(headingPlugin);
 * eventBus.emit('HEADING_CHANGED', { level: 1 }); // Apply H1
 * eventBus.emit('HEADING_CHANGED', { level: 2 }); // Apply H2
 * ```
 */
export const createHeadingPlugin = definePlugin<HeadingPluginOptions>({
  name: 'paragraph:heading',

  defaultOptions: {
    eventName: ParagraphEvents.HEADING_CHANGED,
    checkComposition: true,
    minLevel: 1,
    maxLevel: 6,
  },

  handlers: (options) => ({
    [options.eventName ?? ParagraphEvents.HEADING_CHANGED]: {
      before: ({ selectionManager, options: opts }, data?: unknown) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Heading blocked: IME composition in progress')
          return false
        }

        const level = extractHeadingLevel(data)

        if (level === null || level === undefined) {
          console.warn('Heading blocked: No heading level provided')
          return false
        }

        if (!isValidHeadingLevel(level)) {
          console.warn(
            `Heading blocked: Invalid heading level "${level}" (must be 1-6)`
          )
          return false
        }

        const minLevel = opts.minLevel ?? 1
        const maxLevel = opts.maxLevel ?? 6
        if (level < minLevel || level > maxLevel) {
          console.warn(
            `Heading blocked: Level ${level} is outside range ${minLevel}-${maxLevel}`
          )
          return false
        }

        if (opts.allowedLevels && !opts.allowedLevels.includes(level)) {
          console.warn(
            `Heading blocked: Level ${level} is not in allowed levels`
          )
          return false
        }

        return true
      },

      on: ({ emit }, data?: unknown) => {
        try {
          const level = extractHeadingLevel(data)

          if (!isValidHeadingLevel(level)) {
            return false
          }

          const result = document.execCommand(
            'formatBlock',
            false,
            `<h${level}>`
          )

          if (result) {
            emit(CoreEvents.STYLE_CHANGED, {
              style: 'heading',
              value: level,
            })
          }

          return result
        } catch (error) {
          console.error('Failed to execute heading command:', error)
          return false
        }
      },

      after: () => {},
    },
  }),
})

/**
 * 기본 제목 플러그인 인스턴스
 */
export const HeadingPlugin = createHeadingPlugin()
