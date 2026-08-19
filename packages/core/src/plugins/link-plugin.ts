import { logger } from '@/core/logger'
import { isBlockedByComposition } from '@/core/composition-guard'
import { createErrorReporter } from '@/core/errors'
import type { Plugin, EditorContext } from '@/core'
import {
  ContentEvents,
  CoreEvents,
  createDefaultCommandRegistry,
  runCommand as runCmd,
} from '@/core'

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
 * 프로토콜 없는 입력(`example.com`, `a.com/path`)의 최소 형태 검사.
 *
 * 예전에는 `[a-zA-Z0-9…]` 로 ASCII 만 받았습니다. 프로토콜이 있으면
 * `new URL()` 이 IDN 도 퍼센트 인코딩도 알아서 처리하므로, **비-ASCII 가
 * 거부되는 것은 이 정규식 하나 때문** 이었습니다 —
 *
 *     ko.wikipedia.org/wiki/한국      거부
 *     example.com/path?q=검색어       거부
 *     한국.kr · пример.рф             거부
 *     https://…  같은 주소            전부 통과
 *
 * 게다가 거부는 `logger.warn` 뒤 커맨드를 막는 것이라, 사용자에게는 **아무
 * 일도 일어나지 않습니다.** 유니코드 글자·숫자를 받도록 넓힙니다.
 *
 * 이 검사의 역할은 "URL 이 아닌 문장" 을 걸러 내는 것뿐입니다. 원래도
 * `hello` 같은 맨 단어는 통과했으므로, 넓힌 뒤에도 그 느슨함은 그대로이고
 * 다만 문자 종류에 따른 차별이 없어집니다.
 */
const BARE_URL = /^[\p{L}\p{N}/.][\p{L}\p{N}\-._~:/?#[\]@!$&'()*+,;=%]*$/u

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
    return BARE_URL.test(trimmedUrl)
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
      const reportError = createErrorReporter(eventBus, 'plugin:content:link')
      const composition = context.composition

      const commandRegistry =
        context.commandRegistry ?? createDefaultCommandRegistry(context)
      const runCommand = (name: string, value?: string): boolean =>
        runCmd(commandRegistry, eventBus, name, value)

      const unsubBefore = eventBus.on(eventName, 'before', (data?: unknown) => {
        if (
          isBlockedByComposition(composition, checkComposition, 'Link')
        ) {
          return false
        }
        const { url } = extractLinkData(data)

        if (!url) {
          logger.warn('Link blocked: No URL provided')
          return false
        }

        if (
          validateUrl &&
          !isValidUrl(url, { requireProtocol, allowedProtocols })
        ) {
          logger.warn(`Link blocked: Invalid URL format "${url}"`)
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

          const result = runCommand('createLink', url)

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
          reportError(error, 'Failed to execute link command:')
          return false
        }
      })

      unsubscribers.push(unsubOn)

      const unsubUnlinkBefore = eventBus.on(unlinkEventName, 'before', () => {
        if (
          isBlockedByComposition(composition, checkComposition, 'Unlink')
        ) {
          return false
        }
        return true
      })

      unsubscribers.push(unsubUnlinkBefore)

      const unsubUnlinkOn = eventBus.on(unlinkEventName, 'on', () => {
        try {
          const result = runCommand('unlink')

          if (result) {
            eventBus.emit(CoreEvents.STYLE_CHANGED, {
              style: 'link',
              value: null,
            })
          }

          return result
        } catch (error) {
          reportError(error, 'Failed to execute unlink command:')
          return false
        }
      })

      unsubscribers.push(unsubUnlinkOn)
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
