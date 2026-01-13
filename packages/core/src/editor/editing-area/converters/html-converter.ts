import type { ContentConverter } from '../types'

export class HTMLConverter implements ContentConverter {
  /**
   * HTML을 순수 텍스트로 변환합니다
   * 모든 HTML 태그를 제거하고 엔티티를 변환합니다
   *
   * @param html - HTML 콘텐츠
   * @returns 순수 텍스트 콘텐츠
   *
   * @example
   * ```typescript
   * const converter = new HTMLConverter();
   * converter.htmlToText('<p>Hello <strong>World</strong></p>');
   * // Returns: "Hello World"
   * ```
   */
  htmlToText(html: string): string {
    if (!html) {
      return ''
    }

    let text = html

    text = text.replace(/\r/g, '')
    text = text.replace(/[\t]/g, '')

    text = text.replace(/<p><br\s*\/?><\/p>/gi, '\n')
    text = text.replace(/<p>&nbsp;<\/p>/gi, '\n')
    text = text.replace(/<p><\/p>/gi, '\n')

    text = text.replace(/<br\s*\/?>/gi, '\n')
    text = text.replace(/<\/p>/gi, '\n')
    text = text.replace(/<\/div>/gi, '\n')
    text = text.replace(/<\/li>/gi, '\n')
    text = text.replace(/<\/tr>/gi, '\n')
    text = text.replace(/<\/h[1-6]>/gi, '\n')

    text = this.stripTags(text)
    text = this.unescapeHTML(text)
    text = text.replace(/\n{3,}/g, '\n\n')
    text = text.trim()

    return text
  }

  /**
   * 순수 텍스트를 HTML로 변환합니다
   * HTML을 이스케이프하고 줄을 단락 태그로 감쌉니다
   *
   * @param text - 순수 텍스트 콘텐츠
   * @returns HTML 콘텐츠
   *
   * @example
   * ```typescript
   * const converter = new HTMLConverter();
   * converter.textToHTML('Hello\nWorld');
   * // Returns: "<p>Hello</p><p>World</p>"
   * ```
   */
  textToHTML(text: string): string {
    if (!text) {
      return '<p><br></p>'
    }

    const escaped = this.escapeHTML(text)
    const lines = escaped.split('\n')

    const html = lines
      .map((line) => {
        const trimmed = line.trim()

        if (trimmed === '') {
          return '<p><br></p>'
        }

        return `<p>${line}</p>`
      })
      .join('')

    return html
  }

  /**
   * HTML 특수 문자를 이스케이프합니다
   *
   * @param text - 이스케이프할 텍스트
   * @returns 이스케이프된 텍스트
   *
   * @example
   * ```typescript
   * converter.escapeHTML('<div>Hello & goodbye</div>');
   * // Returns: "&lt;div&gt;Hello &amp; goodbye&lt;/div&gt;"
   * ```
   */
  escapeHTML(text: string): string {
    if (!text) {
      return ''
    }

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  /**
   * HTML 특수 문자를 언이스케이프합니다
   *
   * @param html - 언이스케이프할 HTML
   * @returns 언이스케이프된 텍스트
   *
   * @example
   * ```typescript
   * converter.unescapeHTML('&lt;div&gt;Hello &amp; goodbye&lt;/div&gt;');
   * // Returns: "<div>Hello & goodbye</div>"
   * ```
   */
  unescapeHTML(html: string): string {
    if (!html) {
      return ''
    }

    return html
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
  }

  /**
   * 텍스트에서 HTML 태그를 제거합니다
   *
   * @param html - HTML 콘텐츠
   * @returns HTML 태그가 없는 텍스트
   *
   * @example
   * ```typescript
   * converter.stripTags('<p>Hello <strong>World</strong></p>');
   * // Returns: "Hello World"
   * ```
   */
  stripTags(html: string): string {
    if (!html) {
      return ''
    }

    const temp = document.createElement('div')
    temp.innerHTML = html
    return temp.textContent || temp.innerText || ''
  }

  /**
   * 표시용 HTML을 포맷합니다 (기본 프리티 프린트)
   * 가독성을 위해 들여쓰기와 줄 바꿈을 추가합니다
   *
   * @param html - 포맷할 HTML
   * @returns 포맷된 HTML
   *
   * @example
   * ```typescript
   * converter.formatHTML('<div><p>Hello</p></div>');
   * // Returns:
   * // <div>
   * //   <p>Hello</p>
   * // </div>
   * ```
   */
  formatHTML(html: string): string {
    if (!html) {
      return ''
    }

    let formatted = html

    const blockElements = [
      'div',
      'p',
      'ul',
      'ol',
      'li',
      'table',
      'tr',
      'td',
      'th',
      'thead',
      'tbody',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'header',
      'footer',
      'section',
      'article',
      'nav',
    ]

    blockElements.forEach((tag) => {
      const openTagRegex = new RegExp(`<${tag}([^>]*)>`, 'gi')
      const closeTagRegex = new RegExp(`</${tag}>`, 'gi')

      formatted = formatted.replace(openTagRegex, `\n<${tag}$1>\n`)
      formatted = formatted.replace(closeTagRegex, `\n</${tag}>\n`)
    })

    formatted = formatted.replace(/\n{3,}/g, '\n\n')
    formatted = formatted.trim()

    const lines = formatted.split('\n')

    let indent = 0

    const indented = lines.map((line) => {
      const trimmed = line.trim()

      if (!trimmed) {
        return ''
      }

      if (trimmed.startsWith('</')) {
        indent = Math.max(0, indent - 1)
      }

      const indentedLine = '  '.repeat(indent) + trimmed

      if (
        trimmed.startsWith('<') &&
        !trimmed.startsWith('</') &&
        !trimmed.endsWith('/>')
      ) {
        indent++
      }

      return indentedLine
    })

    return indented.join('\n')
  }

  /**
   * HTML 콘텐츠를 정리합니다
   * 불필요한 공백을 제거하고 콘텐츠를 정규화합니다
   *
   * @param html - 정리할 HTML
   * @returns 정리된 HTML
   */
  cleanHTML(html: string): string {
    if (!html) {
      return ''
    }

    let cleaned = html

    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '')
    cleaned = cleaned.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ''
    )
    cleaned = cleaned.replace(
      /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
      ''
    )
    cleaned = cleaned.replace(/\s+/g, ' ')

    return cleaned
  }

  /**
   * HTML이 비어 있는지 확인합니다 (공백이나 빈 태그만 있는 경우)
   *
   * @param html - 확인할 HTML
   * @returns 비어 있으면 `true`
   */
  isEmpty(html: string): boolean {
    if (!html) {
      return true
    }

    const text = this.stripTags(html).trim()
    const withoutNbsp = text.replace(/\u00A0/g, '').trim()

    return withoutNbsp.length === 0
  }
}
