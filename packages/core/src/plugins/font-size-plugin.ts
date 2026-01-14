import { definePlugin, FontEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 글꼴 크기 플러그인 설정 옵션
 */
export interface FontSizePluginOptions extends BasePluginOptions {
  /**
   * 글꼴 크기 명령을 수신할 이벤트 이름
   * @default 'FONT_SIZE_CHANGED'
   */
  eventName?: string

  /**
   * 허용되는 최소 글꼴 크기 (`1-7` 스케일)
   * @default 1
   */
  minSize?: number

  /**
   * 허용되는 최대 글꼴 크기 (`1-7` 스케일)
   * @default 7
   */
  maxSize?: number
}

/**
 * 이벤트 데이터에서 글꼴 크기 값을 추출합니다
 *
 * @param data - 이벤트 데이터
 * @returns 글꼴 크기 숫자 또는 null
 */
function extractFontSize(data: unknown): number | null {
  if (!data) {
    return null
  }

  if (typeof data === 'object' && data !== null && 'fontSize' in data) {
    const fontSize = (data as { fontSize: unknown }).fontSize

    if (fontSize === undefined || fontSize === null) {
      return null
    }

    const size = Number(fontSize)

    return isNaN(size) ? null : size
  }

  return null
}

/**
 * 글꼴 크기 플러그인 인스턴스를 생성합니다
 *
 * 네이티브 `execCommand` API를 사용하여 선택된 텍스트에 글꼴 크기를 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * 참고: HTML 글꼴 크기 스케일은 `1-7`입니다:
 * - `1` = 가장 작음
 * - `3` = 기본/보통
 * - `7` = 가장 큼
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const fontSizePlugin = createFontSizePlugin({
 *   eventName: 'FONT_SIZE_CHANGED',
 *   checkComposition: true,
 *   minSize: 1,
 *   maxSize: 7
 * });
 *
 * await pluginManager.register(fontSizePlugin);
 * eventBus.emit('FONT_SIZE_CHANGED', { fontSize: 5 });
 * ```
 */
export const createFontSizePlugin = definePlugin<FontSizePluginOptions>({
  name: 'text-style:font-size',

  defaultOptions: {
    eventName: FontEvents.FONT_SIZE_CHANGED,
    checkComposition: true,
    minSize: 1,
    maxSize: 7,
  },

  handlers: (options) => ({
    [options.eventName ?? FontEvents.FONT_SIZE_CHANGED]: {
      before: ({ selectionManager, options: opts }, data?: unknown) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Font size blocked: IME composition in progress')
          return false
        }

        const size = extractFontSize(data)

        if (size === null) {
          console.warn('Font size blocked: Invalid font size')
          return false
        }

        const minSize = opts.minSize ?? 1
        const maxSize = opts.maxSize ?? 7
        if (size < minSize || size > maxSize) {
          console.warn(
            `Font size blocked: Size ${size} is outside range ${minSize}-${maxSize}`
          )
          return false
        }

        return true
      },

      on: ({ emit }, data?: unknown) => {
        try {
          const fontSize = extractFontSize(data)

          if (fontSize === null) {
            return false
          }

          emit(CoreEvents.CAPTURE_SNAPSHOT)
          const sizeStr = String(fontSize)
          const result = document.execCommand('fontSize', false, sizeStr)

          if (result) {
            emit(CoreEvents.STYLE_CHANGED, {
              style: 'fontSize',
              value: fontSize,
            })
          }

          return result
        } catch (error) {
          console.error('Failed to execute font size command:', error)
          return false
        }
      },

      after: () => {},
    },
  }),
})

/**
 * 기본 글꼴 크기 플러그인 인스턴스
 */
export const FontSizePlugin = createFontSizePlugin()
