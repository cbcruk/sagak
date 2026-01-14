import { definePlugin, FontEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 글꼴 패밀리 플러그인 옵션
 */
export interface FontFamilyPluginOptions extends BasePluginOptions {
  /**
   * 글꼴 패밀리 명령을 수신할 이벤트 이름
   * @default 'FONT_FAMILY_CHANGED'
   */
  eventName?: string

  /**
   * 허용된 글꼴 패밀리 목록 (선택적 검증)
   * 제공된 경우 이 글꼴만 허용됩니다
   */
  allowedFonts?: string[]
}

/**
 * 이벤트 데이터에서 글꼴 패밀리 값 추출
 *
 * @param data - 이벤트 데이터
 * @returns 글꼴 패밀리 문자열 또는 null
 */
function extractFontFamily(data: unknown): string | null {
  if (!data) {
    return null
  }

  if (typeof data === 'object' && data !== null && 'fontFamily' in data) {
    const fontFamily = (data as { fontFamily: unknown }).fontFamily

    return typeof fontFamily === 'string' ? fontFamily : null
  }

  return null
}

/**
 * 글꼴 패밀리 플러그인 생성
 *
 * 네이티브 `execCommand` API를 사용하여 선택된 텍스트에 글꼴 패밀리 서식을 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 옵션
 * @returns `Plugin` 인스턴스
 *
 * @example
 * ```typescript
 * const fontFamilyPlugin = createFontFamilyPlugin({
 *   eventName: 'FONT_FAMILY_CHANGED',
 *   checkComposition: true,
 *   allowedFonts: ['Arial', 'Times New Roman', 'Courier New']
 * });
 *
 * await pluginManager.register(fontFamilyPlugin);
 * eventBus.emit('FONT_FAMILY_CHANGED', { fontFamily: 'Arial' });
 * ```
 */
export const createFontFamilyPlugin = definePlugin<FontFamilyPluginOptions>({
  name: 'text-style:font-family',

  defaultOptions: {
    eventName: FontEvents.FONT_FAMILY_CHANGED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? FontEvents.FONT_FAMILY_CHANGED]: {
      before: ({ selectionManager, options: opts }, data?: unknown) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Font family blocked: IME composition in progress')
          return false
        }

        const fontFamily = extractFontFamily(data)

        if (!fontFamily) {
          console.warn('Font family blocked: No font family provided')
          return false
        }

        if (opts.allowedFonts && !opts.allowedFonts.includes(fontFamily)) {
          console.warn(
            `Font family blocked: "${fontFamily}" is not in allowed fonts`
          )
          return false
        }

        return true
      },

      on: ({ emit }, data?: unknown) => {
        try {
          const fontFamily = extractFontFamily(data)

          if (!fontFamily) {
            return false
          }

          emit(CoreEvents.CAPTURE_SNAPSHOT)
          const result = document.execCommand('fontName', false, fontFamily)

          if (result) {
            emit(CoreEvents.STYLE_CHANGED, {
              style: 'fontFamily',
              value: fontFamily,
            })
          }

          return result
        } catch (error) {
          console.error('Failed to execute font family command:', error)
          return false
        }
      },

      after: () => {},
    },
  }),
})

/**
 * 기본 글꼴 패밀리 플러그인 인스턴스
 */
export const FontFamilyPlugin = createFontFamilyPlugin()
