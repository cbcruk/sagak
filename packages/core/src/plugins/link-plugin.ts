import type { Plugin, EditorContext } from '@/core'
import { ContentEvents, CoreEvents } from '@/core'

/**
 * 링크 플러그인 설정 옵션
 */
export interface LinkPluginOptions {
  /**
   * 링크 생성/편집을 수신할 이벤트 이름
   * @default 'LINK_CHANGED'
   */
  eventName?: string

  /**
   * 링크 제거를 수신할 이벤트 이름
   * @default 'LINK_REMOVED'
   */
  unlinkEventName?: string

  /**
   * 링크 적용 전에 IME 입력 상태를 확인할지 여부
   * @default true
   */
  checkComposition?: boolean

  /**
   * URL 형식을 검증할지 여부
   * @default true
   */
  validateUrl?: boolean

  /**
   * 프로토콜(`http://` 또는 `https://`)을 요구할지 여부
   * @default false
   */
  requireProtocol?: boolean

  /**
   * 허용된 URL 프로토콜
   * @default ['http:', 'https:', 'mailto:', 'tel:']
   */
  allowedProtocols?: string[]

  /**
   * 기본적으로 새 창/탭에서 링크를 열지 여부
   * @default false
   */
  openInNewWindow?: boolean
}

/**
 * URL 형식을 검증합니다
 *
 * @param url - 검증할 URL
 * @param options - 검증 옵션
 * @returns 유효한 URL인 경우 `true`
 */
function isValidUrl(
  url: string,
  options: { requireProtocol?: boolean; allowedProtocols?: string[] } = {}
): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  const trimmedUrl = url.trim()

  if (!trimmedUrl) {
    return false
  }

  const {
    requireProtocol = false,
    allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'],
  } = options

  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:']

  for (const dangerous of dangerousProtocols) {
    if (trimmedUrl.toLowerCase().startsWith(dangerous)) {
      return false
    }
  }

  const hasProtocol =
    trimmedUrl.includes('://') ||
    trimmedUrl.startsWith('mailto:') ||
    trimmedUrl.startsWith('tel:')

  if (requireProtocol && !hasProtocol) {
    return false
  }

  if (!hasProtocol) {
    return /^[a-zA-Z0-9/.][a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=%]*$/.test(
      trimmedUrl
    )
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
 * 이벤트 데이터에서 링크 데이터를 추출합니다
 * `{ url: '...' }` 및 직접 문자열 형식을 모두 처리합니다
 *
 * @param data - 이벤트 데이터
 * @returns 링크 URL 및 `target`
 */
function extractLinkData(data: unknown): {
  url: string | null
  target?: string
} {
  if (!data) {
    return { url: null }
  }

  if (typeof data === 'object' && data !== null && 'url' in data) {
    const url = (data as { url: unknown }).url
    const target =
      'target' in data ? (data as { target: unknown }).target : undefined

    return {
      url: typeof url === 'string' ? url : null,
      target: typeof target === 'string' ? target : undefined,
    }
  }

  if (typeof data === 'string') {
    return { url: data }
  }

  return { url: null }
}

/**
 * 링크 플러그인 인스턴스를 생성합니다
 *
 * 네이티브 `execCommand` API를 사용하여 에디터의 하이퍼링크를 관리합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const linkPlugin = createLinkPlugin({
 *   eventName: 'LINK_CHANGED',
 *   validateUrl: true,
 *   requireProtocol: false
 * });
 *
 * await pluginManager.register(linkPlugin);
 *
 * // Create link
 * eventBus.emit('LINK_CHANGED', { url: 'https://example.com' });
 *
 * // Remove link
 * eventBus.emit('LINK_REMOVED');
 * ```
 */
export function createLinkPlugin(options: LinkPluginOptions = {}): Plugin {
  const {
    eventName = ContentEvents.LINK_CHANGED,
    unlinkEventName = ContentEvents.LINK_REMOVED,
    checkComposition = true,
    validateUrl = true,
    requireProtocol = false,
    allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'],
    openInNewWindow = false,
  } = options

  const unsubscribers: Array<() => void> = []

  return {
    name: 'content:link',

    initialize(context: EditorContext) {
      const { eventBus } = context
      const selectionManager = context.selectionManager

      const unsubBefore = eventBus.on(eventName, 'before', (data?: unknown) => {
        if (checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Link blocked: IME composition in progress')
          return false
        }

        const { url } = extractLinkData(data)

        if (!url) {
          console.warn('Link blocked: No URL provided')
          return false
        }

        if (
          validateUrl &&
          !isValidUrl(url, { requireProtocol, allowedProtocols })
        ) {
          console.warn(`Link blocked: Invalid URL format "${url}"`)
          return false
        }

        return true
      })

      unsubscribers.push(unsubBefore)

      const unsubOn = eventBus.on(eventName, 'on', (data?: unknown) => {
        try {
          const { url, target: extractedTarget } = extractLinkData(data)
          const target =
            extractedTarget || (openInNewWindow ? '_blank' : undefined)

          if (!url) {
            return false
          }

          const result = document.execCommand('createLink', false, url)

          if (result) {
            if (target) {
              const selection = window.getSelection()

              if (selection && selection.anchorNode) {
                let node: Node | null = selection.anchorNode

                while (node && node.nodeType !== Node.ELEMENT_NODE) {
                  node = node.parentNode
                }

                if (node && (node as Element).tagName === 'A') {
                  ;(node as HTMLAnchorElement).target = target
                  if (target === '_blank') {
                    ;(node as HTMLAnchorElement).rel = 'noopener noreferrer'
                  }
                }
              }
            }

            eventBus.emit(CoreEvents.STYLE_CHANGED, {
              style: 'link',
              value: url,
            })
          }

          return result
        } catch (error) {
          console.error('Failed to execute link command:', error)
          return false
        }
      })

      unsubscribers.push(unsubOn)

      const unsubAfter = eventBus.on(eventName, 'after', () => {})

      unsubscribers.push(unsubAfter)

      const unsubUnlinkBefore = eventBus.on(unlinkEventName, 'before', () => {
        if (checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Unlink blocked: IME composition in progress')
          return false
        }

        return true
      })

      unsubscribers.push(unsubUnlinkBefore)

      const unsubUnlinkOn = eventBus.on(unlinkEventName, 'on', () => {
        try {
          const result = document.execCommand('unlink', false)

          if (result) {
            eventBus.emit(CoreEvents.STYLE_CHANGED, {
              style: 'link',
              value: null,
            })
          }

          return result
        } catch (error) {
          console.error('Failed to execute unlink command:', error)
          return false
        }
      })

      unsubscribers.push(unsubUnlinkOn)

      const unsubUnlinkAfter = eventBus.on(unlinkEventName, 'after', () => {})

      unsubscribers.push(unsubUnlinkAfter)
    },

    destroy() {
      unsubscribers.forEach((unsub) => unsub())
      unsubscribers.length = 0
    },
  }
}

/**
 * 기본 링크 플러그인 인스턴스
 */
export const LinkPlugin = createLinkPlugin()
