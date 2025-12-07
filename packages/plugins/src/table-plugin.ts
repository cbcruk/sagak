import type { Plugin, EditorContext } from '@sagak/core'
import { ContentEvents, CoreEvents } from '@sagak/core'

/**
 * 표 플러그인 설정 옵션
 */
export interface TablePluginOptions {
  /**
   * 표 생성을 위한 이벤트 이름
   * @default 'TABLE_CREATE'
   */
  createEventName?: string

  /**
   * 행 삽입을 위한 이벤트 이름
   * @default 'TABLE_INSERT_ROW'
   */
  insertRowEventName?: string

  /**
   * 행 삭제를 위한 이벤트 이름
   * @default 'TABLE_DELETE_ROW'
   */
  deleteRowEventName?: string

  /**
   * 열 삽입을 위한 이벤트 이름
   * @default 'TABLE_INSERT_COLUMN'
   */
  insertColumnEventName?: string

  /**
   * 열 삭제를 위한 이벤트 이름
   * @default 'TABLE_DELETE_COLUMN'
   */
  deleteColumnEventName?: string

  /**
   * 표 삭제를 위한 이벤트 이름
   * @default 'TABLE_DELETE'
   */
  deleteTableEventName?: string

  /**
   * IME 입력 상태를 확인할지 여부
   * @default true
   */
  checkComposition?: boolean

  /**
   * 기본 행 개수
   * @default 3
   */
  defaultRows?: number

  /**
   * 기본 열 개수
   * @default 3
   */
  defaultColumns?: number

  /**
   * 최대 행 개수
   * @default 100
   */
  maxRows?: number

  /**
   * 최대 열 개수
   * @default 50
   */
  maxColumns?: number

  /**
   * 기본 표 테두리
   * @default '1'
   */
  defaultBorder?: string

  /**
   * 기본 표 너비
   * @default '100%'
   */
  defaultWidth?: string
}

/**
 * 지정된 크기의 표 요소를 생성합니다
 */
function createTable(
  rows: number,
  cols: number,
  options: { border?: string; width?: string } = {}
): HTMLTableElement {
  const { border = '1', width = '100%' } = options

  const table = document.createElement('table')
  table.border = border
  table.style.width = width
  table.style.borderCollapse = 'collapse'

  const tbody = document.createElement('tbody')

  for (let i = 0; i < rows; i++) {
    const tr = document.createElement('tr')

    for (let j = 0; j < cols; j++) {
      const td = document.createElement('td')
      td.style.border = '1px solid #ddd'
      td.style.padding = '8px'
      td.innerHTML = '<br>'

      tr.appendChild(td)
    }

    tbody.appendChild(tr)
  }

  table.appendChild(tbody)

  return table
}

/**
 * 현재 선택 영역을 포함하는 표 요소를 찾습니다
 */
function findTableAtSelection(): HTMLTableElement | null {
  const selection = window.getSelection()

  if (!selection || !selection.anchorNode) {
    return null
  }

  let node: Node | null = selection.anchorNode

  while (node && node !== document.body) {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).tagName === 'TABLE'
    ) {
      return node as HTMLTableElement
    }

    node = node.parentNode
  }

  return null
}

/**
 * 현재 선택 영역을 포함하는 표 셀을 찾습니다
 */
function findCellAtSelection(): HTMLTableCellElement | null {
  const selection = window.getSelection()

  if (!selection || !selection.anchorNode) {
    return null
  }

  let node: Node | null = selection.anchorNode

  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element

      if (element.tagName === 'TD' || element.tagName === 'TH') {
        return element as HTMLTableCellElement
      }
    }

    node = node.parentNode
  }

  return null
}

/**
 * 셀의 행 인덱스를 가져옵니다
 */
function getRowIndex(cell: HTMLTableCellElement): number {
  const row = cell.parentElement as HTMLTableRowElement

  if (!row) return -1

  const rows = Array.from(row.parentElement?.children || [])

  return rows.indexOf(row)
}

/**
 * 셀의 열 인덱스를 가져옵니다
 */
function getColumnIndex(cell: HTMLTableCellElement): number {
  const cells = Array.from(cell.parentElement?.children || [])

  return cells.indexOf(cell)
}

/**
 * 이벤트 데이터에서 표 생성 데이터를 추출합니다
 */
function extractTableCreateData(
  data: unknown,
  defaults: { rows: number; cols: number; border: string; width: string }
): { rows: number; cols: number; border: string; width: string } {
  if (!data || typeof data !== 'object') {
    return defaults
  }

  const dataObj = data as Record<string, unknown>

  const rows = typeof dataObj.rows === 'number' ? dataObj.rows : defaults.rows
  const cols =
    typeof dataObj.cols === 'number'
      ? dataObj.cols
      : typeof dataObj.columns === 'number'
        ? dataObj.columns
        : defaults.cols
  const border =
    typeof dataObj.border === 'string' ? dataObj.border : defaults.border
  const width =
    typeof dataObj.width === 'string' ? dataObj.width : defaults.width

  return {
    rows,
    cols,
    border,
    width,
  }
}

/**
 * 이벤트 데이터에서 위치 데이터를 추출합니다 (`'above'`/`'below'` 또는 `'left'`/`'right'`)
 */
function extractPosition(data: unknown, defaultPosition: string): string {
  if (!data || typeof data !== 'object') {
    return defaultPosition
  }

  const dataObj = data as Record<string, unknown>

  return typeof dataObj.position === 'string'
    ? dataObj.position
    : defaultPosition
}

/**
 * 표 플러그인 인스턴스를 생성합니다
 *
 * DOM을 직접 조작하여 에디터의 표를 관리합니다.
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const tablePlugin = createTablePlugin({
 *   defaultRows: 3,
 *   defaultColumns: 3
 * });
 *
 * await pluginManager.register(tablePlugin);
 *
 * // Create table
 * eventBus.emit('TABLE_CREATE', { rows: 3, cols: 3 });
 *
 * // Insert row (cursor must be in table)
 * eventBus.emit('TABLE_INSERT_ROW', { position: 'below' });
 *
 * // Delete table (cursor must be in table)
 * eventBus.emit('TABLE_DELETE');
 * ```
 */
export function createTablePlugin(options: TablePluginOptions = {}): Plugin {
  const {
    createEventName = ContentEvents.TABLE_CREATE,
    insertRowEventName = ContentEvents.TABLE_INSERT_ROW,
    deleteRowEventName = ContentEvents.TABLE_DELETE_ROW,
    insertColumnEventName = ContentEvents.TABLE_INSERT_COLUMN,
    deleteColumnEventName = ContentEvents.TABLE_DELETE_COLUMN,
    deleteTableEventName = ContentEvents.TABLE_DELETE,
    checkComposition = true,
    defaultRows = 3,
    defaultColumns = 3,
    maxRows = 100,
    maxColumns = 50,
    defaultBorder = '1',
    defaultWidth = '100%',
  } = options

  const unsubscribers: Array<() => void> = []

  return {
    name: 'content:table',
    initialize(context: EditorContext) {
      const { eventBus } = context
      const selectionManager = context.selectionManager

      const unsubCreateBefore = eventBus.on(
        createEventName,
        'before',
        (data?: unknown) => {
          if (checkComposition && selectionManager?.getIsComposing()) {
            console.warn('Table create blocked: IME composition in progress')
            return false
          }

          const { rows, cols } = extractTableCreateData(data, {
            rows: defaultRows,
            cols: defaultColumns,
            border: defaultBorder,
            width: defaultWidth,
          })

          if (rows < 1 || rows > maxRows) {
            console.warn(
              `Table create blocked: rows ${rows} is outside range 1-${maxRows}`
            )
            return false
          }

          if (cols < 1 || cols > maxColumns) {
            console.warn(
              `Table create blocked: columns ${cols} is outside range 1-${maxColumns}`
            )
            return false
          }

          return true
        }
      )

      unsubscribers.push(unsubCreateBefore)

      const unsubCreateOn = eventBus.on(
        createEventName,
        'on',
        (data?: unknown) => {
          try {
            const { rows, cols, border, width } = extractTableCreateData(data, {
              rows: defaultRows,
              cols: defaultColumns,
              border: defaultBorder,
              width: defaultWidth,
            })

            const table = createTable(rows, cols, { border, width })

            const selection = window.getSelection()

            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0)
              range.deleteContents()
              range.insertNode(table)

              const firstCell = table.querySelector('td')

              if (firstCell) {
                range.selectNodeContents(firstCell)
                range.collapse(true)
                selection.removeAllRanges()
                selection.addRange(range)
              }
            }

            eventBus.emit(CoreEvents.STYLE_CHANGED, {
              style: 'table',
              action: 'create',
              rows,
              cols,
            })

            return true
          } catch (error) {
            console.error('Failed to create table:', error)
            return false
          }
        }
      )

      unsubscribers.push(unsubCreateOn)

      const unsubCreateAfter = eventBus.on(createEventName, 'after', () => {})

      unsubscribers.push(unsubCreateAfter)

      const unsubInsertRowBefore = eventBus.on(
        insertRowEventName,
        'before',
        () => {
          if (checkComposition && selectionManager?.getIsComposing()) {
            console.warn(
              'Table insert row blocked: IME composition in progress'
            )
            return false
          }

          const cell = findCellAtSelection()

          if (!cell) {
            console.warn('Table insert row blocked: No table cell selected')
            return false
          }

          return true
        }
      )

      unsubscribers.push(unsubInsertRowBefore)

      const unsubInsertRowOn = eventBus.on(
        insertRowEventName,
        'on',
        (data?: unknown) => {
          try {
            const cell = findCellAtSelection()

            if (!cell) return false

            const table = findTableAtSelection()

            if (!table) return false

            const position = extractPosition(data, 'below')
            const currentRow = cell.parentElement as HTMLTableRowElement
            const rowIndex = getRowIndex(cell)

            const newRow = document.createElement('tr')
            const colCount = currentRow.children.length

            for (let i = 0; i < colCount; i++) {
              const newCell = document.createElement('td')
              newCell.style.border = '1px solid #ddd'
              newCell.style.padding = '8px'
              newCell.innerHTML = '<br>'
              newRow.appendChild(newCell)
            }

            const tbody = currentRow.parentElement

            if (tbody) {
              if (position === 'above') {
                tbody.insertBefore(newRow, currentRow)
              } else {
                const nextRow = currentRow.nextElementSibling

                if (nextRow) {
                  tbody.insertBefore(newRow, nextRow)
                } else {
                  tbody.appendChild(newRow)
                }
              }
            }

            eventBus.emit(CoreEvents.STYLE_CHANGED, {
              style: 'table',
              action: 'insertRow',
              position,
              rowIndex,
            })

            return true
          } catch (error) {
            console.error('Failed to insert row:', error)
            return false
          }
        }
      )

      unsubscribers.push(unsubInsertRowOn)

      const unsubInsertRowAfter = eventBus.on(
        insertRowEventName,
        'after',
        () => {}
      )

      unsubscribers.push(unsubInsertRowAfter)

      const unsubDeleteRowBefore = eventBus.on(
        deleteRowEventName,
        'before',
        () => {
          if (checkComposition && selectionManager?.getIsComposing()) {
            console.warn(
              'Table delete row blocked: IME composition in progress'
            )
            return false
          }

          const cell = findCellAtSelection()

          if (!cell) {
            console.warn('Table delete row blocked: No table cell selected')
            return false
          }

          return true
        }
      )

      unsubscribers.push(unsubDeleteRowBefore)

      const unsubDeleteRowOn = eventBus.on(deleteRowEventName, 'on', () => {
        try {
          const cell = findCellAtSelection()

          if (!cell) return false

          const row = cell.parentElement as HTMLTableRowElement
          const tbody = row.parentElement

          if (!tbody) return false

          if (tbody.children.length <= 1) {
            console.warn('Cannot delete last row in table')
            return false
          }

          const rowIndex = getRowIndex(cell)

          row.remove()

          eventBus.emit(CoreEvents.STYLE_CHANGED, {
            style: 'table',
            action: 'deleteRow',
            rowIndex,
          })

          return true
        } catch (error) {
          console.error('Failed to delete row:', error)
          return false
        }
      })

      unsubscribers.push(unsubDeleteRowOn)

      const unsubDeleteRowAfter = eventBus.on(
        deleteRowEventName,
        'after',
        () => {}
      )

      unsubscribers.push(unsubDeleteRowAfter)

      const unsubInsertColumnBefore = eventBus.on(
        insertColumnEventName,
        'before',
        () => {
          if (checkComposition && selectionManager?.getIsComposing()) {
            console.warn(
              'Table insert column blocked: IME composition in progress'
            )
            return false
          }

          const cell = findCellAtSelection()

          if (!cell) {
            console.warn('Table insert column blocked: No table cell selected')
            return false
          }

          return true
        }
      )

      unsubscribers.push(unsubInsertColumnBefore)

      const unsubInsertColumnOn = eventBus.on(
        insertColumnEventName,
        'on',
        (data?: unknown) => {
          try {
            const cell = findCellAtSelection()

            if (!cell) return false

            const table = findTableAtSelection()

            if (!table) return false

            const position = extractPosition(data, 'right')
            const colIndex = getColumnIndex(cell)

            const tbody = table.querySelector('tbody')

            if (!tbody) return false

            const rows = Array.from(tbody.children) as HTMLTableRowElement[]

            rows.forEach((row) => {
              const newCell = document.createElement('td')
              newCell.style.border = '1px solid #ddd'
              newCell.style.padding = '8px'
              newCell.innerHTML = '<br>'

              const cells = Array.from(row.children)

              if (position === 'left') {
                row.insertBefore(newCell, cells[colIndex])
              } else {
                const nextCell = cells[colIndex + 1]

                if (nextCell) {
                  row.insertBefore(newCell, nextCell)
                } else {
                  row.appendChild(newCell)
                }
              }
            })

            eventBus.emit(CoreEvents.STYLE_CHANGED, {
              style: 'table',
              action: 'insertColumn',
              position,
              colIndex,
            })

            return true
          } catch (error) {
            console.error('Failed to insert column:', error)
            return false
          }
        }
      )

      unsubscribers.push(unsubInsertColumnOn)

      const unsubInsertColumnAfter = eventBus.on(
        insertColumnEventName,
        'after',
        () => {}
      )

      unsubscribers.push(unsubInsertColumnAfter)

      const unsubDeleteColumnBefore = eventBus.on(
        deleteColumnEventName,
        'before',
        () => {
          if (checkComposition && selectionManager?.getIsComposing()) {
            console.warn(
              'Table delete column blocked: IME composition in progress'
            )
            return false
          }

          const cell = findCellAtSelection()

          if (!cell) {
            console.warn('Table delete column blocked: No table cell selected')
            return false
          }

          return true
        }
      )

      unsubscribers.push(unsubDeleteColumnBefore)

      const unsubDeleteColumnOn = eventBus.on(
        deleteColumnEventName,
        'on',
        () => {
          try {
            const cell = findCellAtSelection()

            if (!cell) return false

            const table = findTableAtSelection()

            if (!table) return false

            const colIndex = getColumnIndex(cell)

            const row = cell.parentElement as HTMLTableRowElement

            if (row.children.length <= 1) {
              console.warn('Cannot delete last column in table')
              return false
            }

            const tbody = table.querySelector('tbody')

            if (!tbody) return false

            const rows = Array.from(tbody.children) as HTMLTableRowElement[]

            rows.forEach((row) => {
              const cells = Array.from(row.children)
              if (cells[colIndex]) {
                cells[colIndex].remove()
              }
            })

            eventBus.emit(CoreEvents.STYLE_CHANGED, {
              style: 'table',
              action: 'deleteColumn',
              colIndex,
            })

            return true
          } catch (error) {
            console.error('Failed to delete column:', error)
            return false
          }
        }
      )

      unsubscribers.push(unsubDeleteColumnOn)

      const unsubDeleteColumnAfter = eventBus.on(
        deleteColumnEventName,
        'after',
        () => {}
      )

      unsubscribers.push(unsubDeleteColumnAfter)

      const unsubDeleteTableBefore = eventBus.on(
        deleteTableEventName,
        'before',
        () => {
          if (checkComposition && selectionManager?.getIsComposing()) {
            console.warn('Table delete blocked: IME composition in progress')
            return false
          }

          const table = findTableAtSelection()

          if (!table) {
            console.warn('Table delete blocked: No table selected')
            return false
          }

          return true
        }
      )

      unsubscribers.push(unsubDeleteTableBefore)

      const unsubDeleteTableOn = eventBus.on(deleteTableEventName, 'on', () => {
        try {
          const table = findTableAtSelection()

          if (!table) return false

          table.remove()

          eventBus.emit(CoreEvents.STYLE_CHANGED, {
            style: 'table',
            action: 'delete',
          })

          return true
        } catch (error) {
          console.error('Failed to delete table:', error)
          return false
        }
      })

      unsubscribers.push(unsubDeleteTableOn)

      const unsubDeleteTableAfter = eventBus.on(
        deleteTableEventName,
        'after',
        () => {}
      )

      unsubscribers.push(unsubDeleteTableAfter)
    },

    destroy() {
      unsubscribers.forEach((unsub) => unsub())
      unsubscribers.length = 0
    },
  }
}

/**
 * 기본 표 플러그인 인스턴스
 */
export const TablePlugin = createTablePlugin()
