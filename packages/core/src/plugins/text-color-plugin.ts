import { definePlugin, FontEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 텍스트 색상 플러그인 설정 옵션
 */
export interface TextColorPluginOptions extends BasePluginOptions {
  /**
   * 텍스트 색상 명령을 수신할 이벤트 이름
   * @default 'TEXT_COLOR_CHANGED'
   */
  eventName?: string

  /**
   * 허용된 색상 목록 (선택적 검증)
   * 제공된 경우 이 색상만 허용됩니다
   */
  allowedColors?: string[]

  /**
   * 색상 형식을 검증할지 여부
   * @default true
   */
  validateFormat?: boolean
}

/**
 * 간단한 색상 형식 검증
 * hex (`#RGB` 또는 `#RRGGBB`), `rgb()` 및 일반 색상 이름을 허용합니다
 *
 * @param color - 검증할 색상 값
 * @returns 유효한 색상 형식인 경우 `true`
 */
function isValidColor(color: string): boolean {
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)) {
    return true
  }

  if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color)) {
    return true
  }

  if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/.test(color)) {
    return true
  }

  if (/^[a-z]+$/i.test(color)) {
    return true
  }

  return false
}

/**
 * 이벤트 데이터에서 색상 값을 추출합니다
 *
 * @param data - 이벤트 데이터
 * @returns 색상 문자열 또는 `null`
 */
function extractColor(data: unknown): string | null {
  if (!data) {
    return null
  }

  if (typeof data === 'object' && data !== null && 'color' in data) {
    const color = (data as { color: unknown }).color

    return typeof color === 'string' ? color : null
  }

  return null
}

/**
 * 텍스트 색상 플러그인 인스턴스를 생성합니다
 *
 * 네이티브 `execCommand` API를 사용하여 선택된 텍스트에 색상을 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const textColorPlugin = createTextColorPlugin({
 *   eventName: 'TEXT_COLOR_CHANGED',
 *   checkComposition: true,
 *   allowedColors: ['#FF0000', '#00FF00', '#0000FF']
 * });
 *
 * await pluginManager.register(textColorPlugin);
 * eventBus.emit('TEXT_COLOR_CHANGED', { color: '#FF0000' });
 * ```
 */
export const createTextColorPlugin = definePlugin<TextColorPluginOptions>({
  name: 'text-style:text-color',

  defaultOptions: {
    eventName: FontEvents.TEXT_COLOR_CHANGED,
    checkComposition: true,
    validateFormat: true,
  },

  handlers: (options) => ({
    [options.eventName ?? FontEvents.TEXT_COLOR_CHANGED]: {
      before: ({ selectionManager, options: opts }, data?: unknown) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Text color blocked: IME composition in progress')
          return false
        }

        const color = extractColor(data)

        if (!color) {
          console.warn('Text color blocked: No color provided')
          return false
        }

        const validateFormat = opts.validateFormat ?? true
        if (validateFormat && !isValidColor(color)) {
          console.warn(`Text color blocked: Invalid color format "${color}"`)
          return false
        }

        if (opts.allowedColors && !opts.allowedColors.includes(color)) {
          console.warn(
            `Text color blocked: "${color}" is not in allowed colors`
          )
          return false
        }

        return true
      },

      on: ({ emit }, data?: unknown) => {
        try {
          const color = extractColor(data)

          if (!color) {
            return false
          }

          const result = document.execCommand('foreColor', false, color)

          if (result) {
            emit(CoreEvents.STYLE_CHANGED, {
              style: 'textColor',
              value: color,
            })
          }

          return result
        } catch (error) {
          console.error('Failed to execute text color command:', error)
          return false
        }
      },

      after: () => {},
    },
  }),
})

/**
 * 기본 텍스트 색상 플러그인 인스턴스
 */
export const TextColorPlugin = createTextColorPlugin()
