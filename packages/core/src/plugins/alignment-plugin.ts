import { definePlugin, ParagraphEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 정렬 유형 옵션
 */
export type AlignmentType = 'left' | 'center' | 'right' | 'justify'

/**
 * 정렬 플러그인 설정 옵션
 */
export interface AlignmentPluginOptions extends BasePluginOptions {
  /**
   * 정렬 명령을 수신할 이벤트 이름
   * @default 'ALIGNMENT_CHANGED'
   */
  eventName?: string

  /**
   * 허용된 정렬 유형 목록 (선택적 검증)
   * 제공된 경우 이 유형만 허용됩니다
   */
  allowedAlignments?: AlignmentType[]
}

/**
 * 정렬 유형을 `execCommand` 문자열에 매핑합니다
 */
const ALIGNMENT_COMMANDS: Record<AlignmentType, string> = {
  left: 'justifyLeft',
  center: 'justifyCenter',
  right: 'justifyRight',
  justify: 'justifyFull',
}

/**
 * 정렬 유형을 검증합니다
 *
 * @param align - 검증할 정렬 값
 * @returns 유효한 정렬 유형인 경우 `true`
 */
function isValidAlignment(align: unknown): align is AlignmentType {
  return (
    typeof align === 'string' &&
    (align === 'left' ||
      align === 'center' ||
      align === 'right' ||
      align === 'justify')
  )
}

/**
 * 이벤트 데이터에서 정렬 값을 추출합니다
 * `{ align: 'center' }` 및 직접 문자열 형식을 모두 처리합니다
 *
 * @param data - 이벤트 데이터
 * @returns 정렬 값 또는 `null`
 */
function extractAlignment(data: unknown): unknown {
  if (!data) {
    return null
  }

  if (typeof data === 'object' && data !== null && 'align' in data) {
    return (data as { align: unknown }).align
  }

  return data
}

/**
 * 정렬 플러그인 인스턴스를 생성합니다
 *
 * 네이티브 `execCommand` API를 사용하여 텍스트 정렬 형식을 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const alignmentPlugin = createAlignmentPlugin({
 *   eventName: 'ALIGNMENT_CHANGED',
 *   checkComposition: true,
 *   allowedAlignments: ['left', 'center', 'right']
 * });
 *
 * await pluginManager.register(alignmentPlugin);
 * eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' });
 * eventBus.emit('ALIGNMENT_CHANGED', { align: 'right' });
 * ```
 */
export const createAlignmentPlugin = definePlugin<AlignmentPluginOptions>({
  name: 'paragraph:alignment',

  defaultOptions: {
    eventName: ParagraphEvents.ALIGNMENT_CHANGED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? ParagraphEvents.ALIGNMENT_CHANGED]: {
      before: ({ selectionManager, options: opts }, data?: unknown) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Alignment blocked: IME composition in progress')
          return false
        }

        const align = extractAlignment(data)

        if (!align) {
          console.warn('Alignment blocked: No alignment provided')
          return false
        }

        if (!isValidAlignment(align)) {
          console.warn(
            `Alignment blocked: Invalid alignment "${align}" (must be left, center, right, or justify)`
          )
          return false
        }

        if (opts.allowedAlignments && !opts.allowedAlignments.includes(align)) {
          console.warn(
            `Alignment blocked: "${align}" is not in allowed alignments`
          )
          return false
        }

        return true
      },

      on: ({ emit }, data?: unknown) => {
        try {
          const align = extractAlignment(data)

          if (!isValidAlignment(align)) {
            return false
          }

          emit(CoreEvents.CAPTURE_SNAPSHOT)
          const command = ALIGNMENT_COMMANDS[align]
          const result = document.execCommand(command, false)

          if (result) {
            emit(CoreEvents.STYLE_CHANGED, {
              style: 'alignment',
              value: align,
            })
          }

          return result
        } catch (error) {
          console.error('Failed to execute alignment command:', error)
          return false
        }
      },

      after: () => {},
    },
  }),
})

/**
 * 기본 정렬 플러그인 인스턴스
 */
export const AlignmentPlugin = createAlignmentPlugin()
