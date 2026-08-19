import { logger } from '@/core/logger'
import { definePlugin, FontEvents } from '@/core'
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
 * 받을 수 있는 두 가지 값
 *
 * - `legacy`: 1–7 스케일 숫자 (기존 API)
 * - `css`: `'24px'` 같은 CSS 길이
 */
type FontSizeValue =
  | { kind: 'legacy'; size: number }
  | { kind: 'css'; value: string }

/**
 * `native-font-size` 의 `resolveSize` 와 **같은 꼴**을 받습니다.
 *
 * 커맨드 층은 처음부터 CSS 길이를 받고 있었는데 여기서 `Number()` 로 눌러
 * 버려서 `'24px'` 가 `NaN` 이 됐습니다. 그래서 툴바는 1–7 스케일밖에 못
 * 썼고, 라벨(9·10·11…)과 실제 크기(10·13·16…)가 어긋난 채였습니다.
 */
const CSS_LENGTH = /^-?[\d.]+(px|pt|em|rem|%)$/

/**
 * 이벤트 데이터에서 글꼴 크기 값을 추출합니다
 *
 * @param data - 이벤트 데이터
 * @returns 1–7 스케일 값 또는 CSS 길이, 판단 불가 시 null
 */
function extractFontSize(data: unknown): FontSizeValue | null {
  if (!data) {
    return null
  }

  if (typeof data === 'object' && data !== null && 'fontSize' in data) {
    const fontSize = (data as { fontSize: unknown }).fontSize

    if (fontSize === undefined || fontSize === null) {
      return null
    }

    if (typeof fontSize === 'string') {
      const trimmed = fontSize.trim()
      if (CSS_LENGTH.test(trimmed)) {
        return { kind: 'css', value: trimmed }
      }
    }

    /* 단위가 없으면 예전처럼 1–7 스케일로 봅니다 (`'large'` 는 여기서 막힙니다) */
    const size = Number(fontSize)

    return isNaN(size) ? null : { kind: 'legacy', size }
  }

  return null
}

/**
 * 글꼴 크기 플러그인 인스턴스를 생성합니다
 *
 * 네이티브 `execCommand` API를 사용하여 선택된 텍스트에 글꼴 크기를 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * 값은 두 가지를 받습니다.
 *
 * | 꼴 | 예 | 비고 |
 * | --- | --- | --- |
 * | 1–7 스케일 | `5` | 기존 API. `minSize`/`maxSize` 가 걸립니다 |
 * | CSS 길이 | `'24px'` | 크기가 곧 값입니다. 범위 검사 없음 |
 *
 * 커맨드 층(`native-font-size`)은 처음부터 둘 다 받고 있었는데, 이 플러그인이
 * `Number()` 로 눌러 CSS 를 막고 있었습니다. 그 탓에 툴바가 1–7 스케일에
 * 묶여 라벨(9·10·11…)과 실제 크기(10·13·16…)가 어긋난 채였습니다.
 *
 * 1–7 스케일에서:
 * - `1` = 가장 작음 (10px)
 * - `3` = 기본/보통 (16px)
 * - `7` = 가장 큼 (48px)
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

  compositionLabel: 'Font size',

  defaultOptions: {
    eventName: FontEvents.FONT_SIZE_CHANGED,
    checkComposition: true,
    minSize: 1,
    maxSize: 7,
  },

  handlers: (options) => ({
    [options.eventName ?? FontEvents.FONT_SIZE_CHANGED]: (
      { options: opts, reportError, runCommand },
      data?: unknown
    ) => {
      const parsed = extractFontSize(data)

      if (parsed === null) {
        logger.warn('Font size blocked: Invalid font size')
        return false
      }

      /*
       * `minSize`/`maxSize` 는 **1–7 스케일에만** 겁니다. 옵션 설명부터가
       * 그 스케일이고, CSS 길이에 1~7 을 들이대면 `24px` 가 막힙니다.
       */
      if (parsed.kind === 'legacy') {
        const minSize = opts.minSize ?? 1
        const maxSize = opts.maxSize ?? 7
        if (parsed.size < minSize || parsed.size > maxSize) {
          logger.warn(
            `Font size blocked: Size ${parsed.size} is outside range ${minSize}-${maxSize}`
          )
          return false
        }
      }

      try {
        const value =
          parsed.kind === 'legacy' ? String(parsed.size) : parsed.value
        const result = runCommand('fontSize', value)

        return result
      } catch (error) {
        reportError(error, 'Failed to execute font size command:')
        return false
      }
    },
  }),
})

/**
 * 기본 글꼴 크기 플러그인 인스턴스
 */
export const FontSizePlugin = createFontSizePlugin()
