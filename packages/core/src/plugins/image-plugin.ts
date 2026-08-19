import { logger } from '@/core/logger'
import { modelState, runModelCommand } from '@/model/bridge'
import {
  deleteImage,
  imageAt,
  insertImage,
  updateImage,
} from '@/model/commands'
import { createErrorReporter } from '@/core/errors'
import type { Plugin, EditorContext } from '@/core'
import { ContentEvents, CoreEvents } from '@/core'

/**
 * 이미지 플러그인 설정 옵션
 */
export interface ImagePluginOptions {
  /**
   * 이미지 삽입을 수신할 이벤트 이름
   * @default 'IMAGE_INSERT'
   */
  insertEventName?: string

  /**
   * 이미지 속성 업데이트를 수신할 이벤트 이름
   * @default 'IMAGE_UPDATE'
   */
  updateEventName?: string

  /**
   * 이미지 삭제를 수신할 이벤트 이름
   * @default 'IMAGE_DELETE'
   */
  deleteEventName?: string

  /**
   * 변경 사항 적용 전에 IME 입력 상태를 확인할지 여부
   * @default true
   */
  checkComposition?: boolean

  /**
   * 이미지 URL 형식을 검증할지 여부
   * @default true
   */
  validateUrl?: boolean

  /**
   * 이미지에 허용된 URL 프로토콜
   * @default ['http:', 'https:', 'data:']
   */
  allowedProtocols?: string[]

  /**
   * 최대 이미지 너비 (픽셀)
   * @default 1920
   */
  maxWidth?: number

  /**
   * 최대 이미지 높이 (픽셀)
   * @default 1080
   */
  maxHeight?: number

  /**
   * 기본 이미지 너비
   * @default undefined (원본 크기)
   */
  defaultWidth?: string

  /**
   * 기본 이미지 높이
   * @default undefined (원본 크기)
   */
  defaultHeight?: string
}

/**
 * 이미지 정렬 옵션
 */
export type ImageAlignment = 'left' | 'center' | 'right' | 'none'

/**
 * 이미지 데이터 인터페이스
 */
export interface ImageData {
  /**
   * 이미지 소스 URL
   */
  src: string

  /**
   * 이미지 너비 (CSS 값: `'100px'`, `'50%'` 등)
   */
  width?: string

  /**
   * 이미지 높이 (CSS 값: `'100px'`, `'50%'` 등)
   */
  height?: string

  /**
   * 접근성을 위한 대체 텍스트
   */
  alt?: string

  /**
   * 이미지 정렬
   *
   * 정렬은 **글이 어디에 놓이는가**라는 문서의 뜻이라 모델이 압니다 —
   * 문단의 정렬과 같은 자리입니다.
   */
  alignment?: ImageAlignment

  /**
   * 이미지 테두리 (CSS 값: `'1px solid #000'` 등)
   *
   * @deprecated **문서에 안 붙습니다.** 테두리는 생김새라 스타일시트의
   * 몫입니다 (`docs/prosemirror-migration.md` §10).
   */
  border?: string
}

/**
 * 이미지 URL 형식을 검증합니다
 */
function isValidImageUrl(
  url: string,
  options: { allowedProtocols?: string[] } = {}
): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  const trimmedUrl = url.trim()

  if (!trimmedUrl) {
    return false
  }

  const { allowedProtocols = ['http:', 'https:', 'data:'] } = options

  const dangerousProtocols = ['javascript:', 'vbscript:']

  for (const dangerous of dangerousProtocols) {
    if (trimmedUrl.toLowerCase().startsWith(dangerous)) {
      return false
    }
  }

  if (trimmedUrl.startsWith('data:')) {
    return /^data:image\/[a-z]+;base64,/.test(trimmedUrl)
  }

  try {
    const urlObj = new URL(trimmedUrl)

    if (
      allowedProtocols.length > 0 &&
      !allowedProtocols.includes(urlObj.protocol)
    ) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * 이미지 플러그인 인스턴스를 생성합니다
 *
 * 직접 DOM 조작을 사용하여 에디터의 이미지를 관리합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const imagePlugin = createImagePlugin({
 *   validateUrl: true,
 *   maxWidth: 1920,
 *   maxHeight: 1080
 * });
 *
 * await pluginManager.register(imagePlugin);
 *
 * // Insert image
 * eventBus.emit('IMAGE_INSERT', {
 *   src: 'https://example.com/image.jpg',
 *   width: '300px',
 *   alt: 'Example image',
 *   alignment: 'center'
 * });
 *
 * // Update image properties
 * eventBus.emit('IMAGE_UPDATE', {
 *   width: '500px',
 *   alignment: 'right'
 * });
 *
 * // Delete image
 * eventBus.emit('IMAGE_DELETE');
 * ```
 */
export function createImagePlugin(options: ImagePluginOptions = {}): Plugin {
  const {
    insertEventName = ContentEvents.IMAGE_INSERT,
    updateEventName = ContentEvents.IMAGE_UPDATE,
    deleteEventName = ContentEvents.IMAGE_DELETE,
    validateUrl = true,
    allowedProtocols = ['http:', 'https:', 'data:'],
    maxWidth = 1920,
    maxHeight = 1080,
    defaultWidth,
    defaultHeight,
  } = options

  const unsubscribers: Array<() => void> = []

  return {
    name: 'content:image',

    initialize(context: EditorContext) {
      const { eventBus } = context
      const reportError = createErrorReporter(eventBus, 'plugin:content:image')

      const unsubInsertBefore = eventBus.on(
        insertEventName,
        'before',
        (args?: unknown) => {
          const data = args as ImageData | undefined
          if (!data || !data.src) {
            logger.warn('Image insert blocked: No src provided')
            return false
          }

          if (validateUrl && !isValidImageUrl(data.src, { allowedProtocols })) {
            logger.warn(`Image insert blocked: Invalid image URL "${data.src}"`)
            return false
          }

          if (data.width) {
            const widthPx = parseInt(data.width)
            if (!isNaN(widthPx) && widthPx > maxWidth) {
              logger.warn(
                `Image insert blocked: width ${widthPx}px exceeds maximum ${maxWidth}px`
              )
              return false
            }
          }

          if (data.height) {
            const heightPx = parseInt(data.height)
            if (!isNaN(heightPx) && heightPx > maxHeight) {
              logger.warn(
                `Image insert blocked: height ${heightPx}px exceeds maximum ${maxHeight}px`
              )
              return false
            }
          }

          return true
        }
      )

      unsubscribers.push(unsubInsertBefore)

      const unsubInsertOn = eventBus.on(
        insertEventName,
        'on',
        (args?: unknown) => {
          const data = args as ImageData | undefined

          try {
            if (!data || !data.src) {
              return false
            }

            eventBus.emit(CoreEvents.CAPTURE_SNAPSHOT)

            /*
             * 테두리만 모델에 자리가 없습니다 — 생김새는 스타일시트의
             * 몫입니다. 정렬은 문단의 정렬과 같은 자리라 모델이 압니다.
             */
            const inserted = runModelCommand(
              context,
              insertImage({
                src: data.src,
                alt: data.alt ?? null,
                width: data.width || defaultWidth || null,
                height: data.height || defaultHeight || null,
                align: data.alignment ?? null,
              })
            )

            if (!inserted) {
              return false
            }

            eventBus.emit(CoreEvents.STYLE_CHANGED, {
              style: 'image',
              action: 'insert',
              src: data.src,
            })

            return true
          } catch (error) {
            reportError(error, 'Failed to insert image:')
            return false
          }
        }
      )

      unsubscribers.push(unsubInsertOn)

      const unsubUpdateBefore = eventBus.on(
        updateEventName,
        'before',
        (args?: unknown) => {
          const data = args as Partial<ImageData> | undefined
          if (!data) {
            logger.warn('Image update blocked: No data provided')
            return false
          }

          const state = modelState(context)

          if (!state || !imageAt(state)) {
            logger.warn('Image update blocked: No image selected')
            return false
          }

          if (data.width) {
            const widthPx = parseInt(data.width)

            if (!isNaN(widthPx) && widthPx > maxWidth) {
              logger.warn(
                `Image update blocked: width ${widthPx}px exceeds maximum ${maxWidth}px`
              )
              return false
            }
          }

          if (data.height) {
            const heightPx = parseInt(data.height)

            if (!isNaN(heightPx) && heightPx > maxHeight) {
              logger.warn(
                `Image update blocked: height ${heightPx}px exceeds maximum ${maxHeight}px`
              )
              return false
            }
          }

          return true
        }
      )

      unsubscribers.push(unsubUpdateBefore)

      const unsubUpdateOn = eventBus.on(
        updateEventName,
        'on',
        (args?: unknown) => {
          const data = args as Partial<ImageData> | undefined

          try {
            if (!data) {
              return false
            }

            eventBus.emit(CoreEvents.CAPTURE_SNAPSHOT)

            const changed: Record<string, string | null> = {}
            if (data.src !== undefined) changed.src = data.src
            if (data.alt !== undefined) changed.alt = data.alt
            if (data.width !== undefined) changed.width = data.width
            if (data.height !== undefined) changed.height = data.height
            if (data.alignment !== undefined) changed.align = data.alignment

            const done = runModelCommand(context, updateImage(changed))

            if (!done) {
              return false
            }

            eventBus.emit(CoreEvents.STYLE_CHANGED, {
              style: 'image',
              action: 'update',
            })

            return true
          } catch (error) {
            reportError(error, 'Failed to update image:')
            return false
          }
        }
      )
      unsubscribers.push(unsubUpdateOn)

      const unsubDeleteBefore = eventBus.on(deleteEventName, 'before', () => {
        const state = modelState(context)

        if (!state || !imageAt(state)) {
          logger.warn('Image delete blocked: No image selected')
          return false
        }

        return true
      })

      unsubscribers.push(unsubDeleteBefore)

      const unsubDeleteOn = eventBus.on(deleteEventName, 'on', () => {
        try {
          eventBus.emit(CoreEvents.CAPTURE_SNAPSHOT)

          const done = runModelCommand(context, deleteImage)

          if (!done) {
            return false
          }

          eventBus.emit(CoreEvents.STYLE_CHANGED, {
            style: 'image',
            action: 'delete',
          })

          return true
        } catch (error) {
          reportError(error, 'Failed to delete image:')
          return false
        }
      })

      unsubscribers.push(unsubDeleteOn)
    },

    destroy() {
      unsubscribers.forEach((unsub) => unsub())
      unsubscribers.length = 0
    },
  }
}

/**
 * 기본 이미지 플러그인 인스턴스
 */
export const ImagePlugin = createImagePlugin()
