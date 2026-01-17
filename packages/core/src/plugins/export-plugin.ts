import type { Plugin, EditorContext } from '@/core'

export type ExportFormat = 'html' | 'markdown' | 'text'

export interface ExportPluginOptions {
  /**
   * Default filename for downloads (without extension)
   * @default 'document'
   */
  defaultFilename?: string
}

export const ExportEvents = {
  EXPORT_DOWNLOAD: 'EXPORT_DOWNLOAD',
} as const

export interface ExportDownloadData {
  format: ExportFormat
  filename?: string
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
        case 'blockquote':
          const quoteLines = convertNodeToMarkdown(el).trim().split('\n')
          result += quoteLines.map((line) => `> ${line}`).join('\n') + '\n\n'
          break
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
          content +=
            '\n' + convertListToMarkdown(childEl, 'ul', depth + 1)
        } else if (childTag === 'ol') {
          content +=
            '\n' + convertListToMarkdown(childEl, 'ol', depth + 1)
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
      getInlineContent(cell as HTMLElement).trim().replace(/\|/g, '\\|')
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

function downloadFile(content: string, filename: string, mimeType: string): void {
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

export function createExportPlugin(options: ExportPluginOptions = {}): Plugin {
  const { defaultFilename = 'document' } = options

  const unsubscribers: Array<() => void> = []

  return {
    name: 'utility:export',

    initialize(context: EditorContext) {
      const { eventBus, element } = context

      const getHtmlContent = (): string => {
        return element?.innerHTML || ''
      }

      const convertContent = (format: ExportFormat): string => {
        const html = getHtmlContent()

        switch (format) {
          case 'html':
            return html
          case 'markdown':
            return htmlToMarkdown(html)
          case 'text':
            return htmlToText(html)
        }
      }


      const unsubDownload = eventBus.on(
        ExportEvents.EXPORT_DOWNLOAD,
        'on',
        (args?: unknown) => {
          const data = args as ExportDownloadData | undefined
          if (!data) return

          const content = convertContent(data.format)
          const filename = `${data.filename || defaultFilename}.${getFileExtension(data.format)}`
          const mimeType = getMimeType(data.format)

          downloadFile(content, filename, mimeType)
        }
      )
      unsubscribers.push(unsubDownload)
    },

    destroy() {
      unsubscribers.forEach((unsub) => unsub())
      unsubscribers.length = 0
    },
  }
}

export { htmlToMarkdown, htmlToText }
