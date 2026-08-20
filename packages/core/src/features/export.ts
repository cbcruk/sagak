import type { EditorContext } from '@/core'

/**
 * 내보내기 — **모듈 API 입니다.**
 *
 * ## 이벤트 하나가 하던 일
 *
 * `EXPORT_DOWNLOAD` 는 발행처(내보내기 메뉴)도 처리자도 실재했습니다 — 죽은
 * 배선은 아니었습니다. 다만 **메뉴 하나가 플러그인 하나에게 말을 거는 일**에
 * 이름 문자열과 페이로드 타입이 낀 것뿐입니다. 찾기/바꾸기와 같은 모양입니다.
 *
 * ## 옮기면서 드러난 것 — 편집기 속살이 파일로 나가고 있었습니다
 *
 * 예전에는 `element.innerHTML` 을 읽었습니다. 그것은 **`prosemirror-view` 가
 * 그린 DOM** 이지 문서가 아닙니다. 재 보면 이렇습니다 —
 *
 * ```
 * 찾기 강조가 켜진 채로:
 *   innerHTML      <p><span class="find-highlight" style="…">Hello</span> world</p>
 *   getRawContent  <p>Hello world</p>
 *
 * 표가 있는 문서:
 *   innerHTML      <div class="tableWrapper"><table style="--default-cell-min-width: …">
 *                    <colgroup><col><col></colgroup>…
 *   getRawContent  <table><tbody>…
 * ```
 *
 * 찾기 강조는 **데코레이션**이고 `.tableWrapper`·`<colgroup>` 은 열 너비를
 * 그리는 뷰의 것입니다. 둘 다 문서에 없는 것인데 내보낸 파일에는 있었습니다.
 * 자동 저장이 §11-6 에서 겪은 것과 같은 실수입니다 — **문서를 읽는 자리는
 * 모델입니다.**
 */
export type ExportFormat = 'html' | 'markdown' | 'text'

export interface ExportOptions {
  /** 확장자를 뺀 기본 파일 이름 @default 'document' */
  defaultFilename?: string
}

export interface Exporter {
  /** 지금 문서를 이 형식의 글로 — 파일로 만들지는 않습니다 */
  toText(format: ExportFormat): string
  /** 내려받습니다 */
  download(format: ExportFormat, filename?: string): void
}

function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return convertNodeToMarkdown(doc.body)
}

function convertNodeToMarkdown(node: Node): string {
  let result = ''

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent || ''
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      const tagName = el.tagName.toLowerCase()

      switch (tagName) {
        case 'h1':
          result += `# ${getInlineContent(el)}\n\n`
          break
        case 'h2':
          result += `## ${getInlineContent(el)}\n\n`
          break
        case 'h3':
          result += `### ${getInlineContent(el)}\n\n`
          break
        case 'h4':
          result += `#### ${getInlineContent(el)}\n\n`
          break
        case 'h5':
          result += `##### ${getInlineContent(el)}\n\n`
          break
        case 'h6':
          result += `###### ${getInlineContent(el)}\n\n`
          break
        case 'p':
          result += `${getInlineContent(el)}\n\n`
          break
        case 'br':
          result += '\n'
          break
        case 'hr':
          result += '---\n\n'
          break
        case 'strong':
        case 'b':
          result += `**${getInlineContent(el)}**`
          break
        case 'em':
        case 'i':
          result += `*${getInlineContent(el)}*`
          break
        case 'u':
          result += `<u>${getInlineContent(el)}</u>`
          break
        case 's':
        case 'strike':
        case 'del':
          result += `~~${getInlineContent(el)}~~`
          break
        case 'code':
          result += `\`${el.textContent || ''}\``
          break
        case 'pre':
          result += `\`\`\`\n${el.textContent || ''}\n\`\`\`\n\n`
          break
        case 'blockquote': {
          const quoteLines = convertNodeToMarkdown(el).trim().split('\n')
          result += quoteLines.map((line) => `> ${line}`).join('\n') + '\n\n'
          break
        }
        case 'ul':
          result += convertListToMarkdown(el, 'ul', 0) + '\n'
          break
        case 'ol':
          result += convertListToMarkdown(el, 'ol', 0) + '\n'
          break
        case 'li':
          result += getInlineContent(el)
          break
        case 'a': {
          const href = el.getAttribute('href') || ''
          const text = getInlineContent(el)
          result += `[${text}](${href})`
          break
        }
        case 'img': {
          const src = el.getAttribute('src') || ''
          const alt = el.getAttribute('alt') || ''
          result += `![${alt}](${src})`
          break
        }
        case 'table':
          result += convertTableToMarkdown(el) + '\n'
          break
        case 'div':
        case 'span':
        case 'font':
          result += getInlineContent(el)
          break
        case 'sub':
          result += `<sub>${getInlineContent(el)}</sub>`
          break
        case 'sup':
          result += `<sup>${getInlineContent(el)}</sup>`
          break
        default:
          result += convertNodeToMarkdown(el)
      }
    }
  }

  return result
}

function getInlineContent(el: HTMLElement): string {
  return convertNodeToMarkdown(el)
}

function convertListToMarkdown(
  list: HTMLElement,
  type: 'ul' | 'ol',
  depth: number
): string {
  const items = Array.from(list.children).filter(
    (child) => child.tagName.toLowerCase() === 'li'
  )
  let result = ''
  const indent = '  '.repeat(depth)

  items.forEach((item, index) => {
    const bullet = type === 'ul' ? '-' : `${index + 1}.`
    let content = ''

    for (const child of Array.from(item.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        content += child.textContent || ''
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const childEl = child as HTMLElement
        const childTag = childEl.tagName.toLowerCase()

        if (childTag === 'ul') {
          content += '\n' + convertListToMarkdown(childEl, 'ul', depth + 1)
        } else if (childTag === 'ol') {
          content += '\n' + convertListToMarkdown(childEl, 'ol', depth + 1)
        } else {
          content += getInlineContent(childEl)
        }
      }
    }

    result += `${indent}${bullet} ${content.trim()}\n`
  })

  return result
}

function convertTableToMarkdown(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (rows.length === 0) return ''

  let result = ''
  let headerProcessed = false

  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll('th, td'))
    const cellContents = cells.map((cell) =>
      getInlineContent(cell as HTMLElement)
        .trim()
        .replace(/\|/g, '\\|')
    )

    result += `| ${cellContents.join(' | ')} |\n`

    if (rowIndex === 0 && !headerProcessed) {
      result += `| ${cells.map(() => '---').join(' | ')} |\n`
      headerProcessed = true
    }
  })

  return result
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function getFileExtension(format: ExportFormat): string {
  switch (format) {
    case 'html':
      return 'html'
    case 'markdown':
      return 'md'
    case 'text':
      return 'txt'
  }
}

function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'html':
      return 'text/html'
    case 'markdown':
      return 'text/markdown'
    case 'text':
      return 'text/plain'
  }
}

const modules = new WeakMap<EditorContext, Exporter>()

/**
 * 에디터 하나에 하나입니다.
 *
 * 플러그인이 아닙니다 — 붙어서 무언가를 지켜보는 일이 없고, 부를 때 지금
 * 문서를 읽으면 끝입니다.
 */
export function exporter(
  context: EditorContext,
  options: ExportOptions = {}
): Exporter {
  const existing = modules.get(context)

  if (existing) return existing

  const { defaultFilename = 'document' } = options

  /**
   * **모델에서 읽습니다.** `element.innerHTML` 이 아닙니다 — 위 주석 참고.
   */
  const html = (): string =>
    context.editingAreaManager?.getCurrentArea()?.getRawContent() ?? ''

  const module: Exporter = {
    toText(format) {
      const source = html()

      switch (format) {
        case 'html':
          return source
        case 'markdown':
          return htmlToMarkdown(source)
        case 'text':
          return htmlToText(source)
      }
    },

    download(format, filename) {
      downloadFile(
        module.toText(format),
        `${filename || defaultFilename}.${getFileExtension(format)}`,
        getMimeType(format)
      )
    },
  }

  modules.set(context, module)

  return module
}

export { htmlToMarkdown, htmlToText }
