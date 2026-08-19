import type { Plugin, EditorContext } from '@/core'
import { subscribeToModel } from '@/model/bridge'
import { CoreEvents } from '@/core'

/**
 * Table resize plugin options
 */
export interface TableResizePluginOptions {
  /**
   * Minimum column width in pixels
   * @default 30
   */
  minColumnWidth?: number

  /**
   * Resize handle width in pixels (detection area)
   * @default 8
   */
  handleWidth?: number
}

interface ResizeState {
  isResizing: boolean
  table: HTMLTableElement | null
  columnIndex: number
  startX: number
  startWidths: number[]
  tableWidth: number
}

/**
 * Create table resize plugin
 *
 * Allows resizing table columns by dragging column borders.
 */
export function createTableResizePlugin(
  options: TableResizePluginOptions = {}
): Plugin {
  const { minColumnWidth = 30, handleWidth = 8 } = options

  const unsubscribers: Array<() => void> = []
  let resizeState: ResizeState = {
    isResizing: false,
    table: null,
    columnIndex: -1,
    startX: 0,
    startWidths: [],
    tableWidth: 0,
  }

  return {
    name: 'utility:table-resize',

    initialize(context: EditorContext) {
      const { eventBus, element } = context

      if (!element) {
        return
      }

      const getColumnWidths = (table: HTMLTableElement): number[] => {
        const firstRow = table.querySelector('tr')
        if (!firstRow) return []

        const cells = Array.from(firstRow.children) as HTMLTableCellElement[]
        return cells.map((cell) => cell.offsetWidth)
      }

      const setColumnWidths = (
        table: HTMLTableElement,
        widths: number[]
      ): void => {
        const rows = table.querySelectorAll('tr')

        rows.forEach((row) => {
          const cells = Array.from(row.children) as HTMLTableCellElement[]

          cells.forEach((cell, index) => {
            if (widths[index] !== undefined) {
              cell.style.width = `${widths[index]}px`
            }
          })
        })
      }

      const findCellAndColumnIndex = (
        table: HTMLTableElement,
        clientX: number,
        clientY: number
      ): { cell: HTMLTableCellElement; columnIndex: number } | null => {
        const cells = table.querySelectorAll('td, th')

        for (const cell of cells) {
          const rect = cell.getBoundingClientRect()

          if (
            clientY >= rect.top &&
            clientY <= rect.bottom &&
            Math.abs(clientX - rect.right) <= handleWidth / 2
          ) {
            const row = cell.parentElement as HTMLTableRowElement
            const cellIndex = Array.from(row.children).indexOf(cell)

            if (cellIndex < row.children.length - 1) {
              return {
                cell: cell as HTMLTableCellElement,
                columnIndex: cellIndex,
              }
            }
          }
        }

        return null
      }

      const handleMouseMove = (e: MouseEvent): void => {
        if (resizeState.isResizing && resizeState.table) {
          const deltaX = e.clientX - resizeState.startX
          const newWidths = [...resizeState.startWidths]

          const currentWidth = resizeState.startWidths[resizeState.columnIndex]
          const nextWidth = resizeState.startWidths[resizeState.columnIndex + 1]

          const newCurrentWidth = Math.max(
            minColumnWidth,
            currentWidth + deltaX
          )
          const newNextWidth = Math.max(minColumnWidth, nextWidth - deltaX)

          if (
            newCurrentWidth >= minColumnWidth &&
            newNextWidth >= minColumnWidth
          ) {
            newWidths[resizeState.columnIndex] = newCurrentWidth
            newWidths[resizeState.columnIndex + 1] = newNextWidth
            setColumnWidths(resizeState.table, newWidths)
          }

          e.preventDefault()
          return
        }

        const target = e.target as HTMLElement

        if (!target) return

        const table = target.closest('table')

        if (!table || !element.contains(table)) {
          element.style.cursor = ''
          return
        }

        const result = findCellAndColumnIndex(
          table as HTMLTableElement,
          e.clientX,
          e.clientY
        )

        if (result) {
          element.style.cursor = 'col-resize'
        } else {
          element.style.cursor = ''
        }
      }

      const handleMouseDown = (e: MouseEvent): void => {
        const target = e.target as HTMLElement

        if (!target) return

        const table = target.closest('table') as HTMLTableElement

        if (!table || !element.contains(table)) return

        const result = findCellAndColumnIndex(table, e.clientX, e.clientY)

        if (result) {
          e.preventDefault()


          const widths = getColumnWidths(table)

          if (widths.some((w) => w === 0)) {
            const totalWidth = table.offsetWidth
            const equalWidth = totalWidth / widths.length

            widths.fill(equalWidth)
            setColumnWidths(table, widths)
          }

          resizeState = {
            isResizing: true,
            table,
            columnIndex: result.columnIndex,
            startX: e.clientX,
            startWidths: widths,
            tableWidth: table.offsetWidth,
          }

          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
        }
      }

      const handleMouseUp = (): void => {
        if (resizeState.isResizing) {
          resizeState = {
            isResizing: false,
            table: null,
            columnIndex: -1,
            startX: 0,
            startWidths: [],
            tableWidth: 0,
          }

          document.body.style.cursor = ''
          document.body.style.userSelect = ''
          element.style.cursor = ''

          eventBus.emit(CoreEvents.STYLE_CHANGED, {
            style: 'table',
            action: 'resize',
          })
        }
      }

      element.addEventListener('mousemove', handleMouseMove)
      element.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      /*
       * 표가 생기면 열 너비를 고정해 둡니다.
       *
       * 예전에는 편집 영역이 보일 때(`WYSIWYG_AREA_SHOWN`) 한 번 훑었습니다.
       * 그러면 그 뒤에 만든 표는 안 잡히는데도 아무도 안 봤습니다 — 문서가
       * 바뀔 때 보는 것이 맞습니다.
       */
      unsubscribers.push(
        subscribeToModel(context, () => {
          element.querySelectorAll('table').forEach((table) => {
            table.style.tableLayout = 'fixed'
          })
        })
      )
      unsubscribers.push(() => {
        element.removeEventListener('mousemove', handleMouseMove)
        element.removeEventListener('mousedown', handleMouseDown)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      })
    },

    destroy() {
      unsubscribers.forEach((unsub) => unsub())
      unsubscribers.length = 0
    },
  }
}
