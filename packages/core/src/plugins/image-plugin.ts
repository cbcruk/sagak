import { logger } from '@/core/logger'
import { modelState, runModelCommand } from '@/model/bridge'
import {
  deleteImage,
  imageAt,
  insertImage,
  updateImage,
} from '@/model/commands'
import { isBlockedByComposition } from '@/core/composition-guard'
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
   * @deprecated **문서에 안 붙습니다.** 스키마의 이미지가 갖는 것은 주소·
   * 대체글·너비·높이 넷이라 정렬은 표현할 자리가 없습니다. 지금 제품의
   * 다이얼로그도 이 값을 보내지 않습니다 — 되살리려면 스키마부터 늘려야
   * 합니다 (`docs/prosemirror-migration.md` §10).
   */
  alignment?: ImageAlignment

  /**
   * 이미지 테두리 (CSS 값: `'1px solid #000'` 등)
   *
   * @deprecated `alignment` 와 같은 이유로 문서에 안 붙습니다.
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
    checkComposition = true,
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
      const selectionManager = context.selectionManager

      const unsubInsertBefore = eventBus.on(
        insertEventName,
        'before',
        (args?: unknown) => {
          const data = args as ImageData | undefined

          if (
            isBlockedByComposition(
              selectionManager,
              checkComposition,
              'Image insert'
            )
          ) {
            return false
          }
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
             * `테두리`·`정렬` 은 **모델에 자리가 없습니다.**
             *
             * 스키마의 이미지가 갖는 것은 주소·대체글·너비·높이 넷입니다. 지금
             * 제품의 다이얼로그도 그 넷만 보내므로 잃는 것은 없지만, 이벤트로
             * 직접 부르면 나머지는 조용히 빠집니다.
             */
            const inserted = runModelCommand(
              context,
              insertImage({
                src: data.src,
                alt: data.alt ?? null,
                width: data.width || defaultWidth || null,
                height: data.height || defaultHeight || null,
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

          if (
            isBlockedByComposition(
              selectionManager,
              checkComposition,
              'Image update'
            )
          ) {
            return false
          }
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
        if (
          isBlockedByComposition(
            selectionManager,
            checkComposition,
            'Image delete'
          )
        ) {
          return false
        }
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
