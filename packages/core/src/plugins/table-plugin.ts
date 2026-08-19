import { logger } from '@/core/logger'
import { createErrorReporter } from '@/core/errors'
import type { Plugin, EditorContext } from '@/core'
import { ContentEvents, CoreEvents } from '@/core'
import { runModelCommand, modelState } from '@/model/bridge'
import { commands, insertTable, isInTable } from '@/model/commands'
import type { Command } from '@/model/commands'

/**
 * 표.
 *
 * ## 무엇이 바뀌었나
 *
 * 이 파일은 767줄이었습니다. 표를 `document.createElement` 로 짓고,
 * `range.insertNode` 로 꽂고, 행·열을 `<tr>`·`<td>` 를 직접 넣고 빼며
 * 다뤘습니다.
 *
 * 편집 영역이 문서 모델을 갖게 되면서 그 길이 **막힌 정도가 아니라 틀렸습니다**
 * — 문단 안에 `<table>` 을 꽂으면 스키마를 지나며 통째로 사라집니다.
 *
 * `prosemirror-tables` 가 그 일을 전부 알고 있습니다. 셀 병합·열 너비까지
 * 다루는 커맨드들이라 우리 쪽은 **이벤트를 커맨드로 옮기는 것만** 남습니다.
 * 마지막 행·열을 못 지우게 막는 것도 그쪽이 압니다 (`deleteRow` 가 마지막
 * 행이면 표를 지웁니다 — 예전 동작과 다르지만 그게 더 자연스럽습니다).
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
}

/**
 * 이벤트 데이터에서 표 생성 데이터를 추출합니다
 */
function extractTableCreateData(
  data: unknown,
  defaults: { rows: number; cols: number }
): { rows: number; cols: number } {
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

  return { rows, cols }
}

/**
 * 이벤트 데이터에서 위치를 추출합니다 (`'above'`/`'below'` 또는 `'left'`/`'right'`)
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
 * @example
 * ```typescript
 * eventBus.emit('TABLE_CREATE', { rows: 3, cols: 3 })
 * eventBus.emit('TABLE_INSERT_ROW', { position: 'below' })
 * eventBus.emit('TABLE_DELETE')
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
    defaultRows = 3,
    defaultColumns = 3,
    maxRows = 100,
    maxColumns = 50,
  } = options

  const unsubscribers: Array<() => void> = []

  return {
    name: 'content:table',
    initialize(context: EditorContext) {
      const { eventBus } = context
      const reportError = createErrorReporter(eventBus, 'plugin:content:table')

      /** 지금 캐럿이 표 안인가 — 행·열 명령의 전제입니다 */
      const inTable = (): boolean => {
        const state = modelState(context)

        return !!state && isInTable(state)
      }

      /**
       * 표 안에서만 되는 명령들의 `before` 가드.
       *
       * IME 조합 중이면 막고, 표 밖이면 막습니다. 예전에는 `findCellAtSelection`
       * 이 DOM 을 거슬러 올라가며 `<td>` 를 찾았습니다.
       */
      const guard = (label: string) => (): boolean => {

        if (!inTable()) {
          logger.warn(`${label} blocked: No table cell selected`)
          return false
        }

        return true
      }

      /** 커맨드 하나를 이벤트에 잇습니다 */
      const bind = (
        event: string,
        label: string,
        command: (data?: unknown) => Command,
        announce: (data?: unknown) => Record<string, unknown>
      ): void => {
        unsubscribers.push(eventBus.on(event, 'before', guard(label)))
        unsubscribers.push(
          eventBus.on(event, 'on', (data?: unknown) => {
            try {
              eventBus.emit(CoreEvents.CAPTURE_SNAPSHOT)

              const done = runModelCommand(context, command(data))

              if (done) {
                eventBus.emit(CoreEvents.STYLE_CHANGED, {
                  style: 'table',
                  ...announce(data),
                })
              }

              return done
            } catch (error) {
              reportError(error, `Failed to ${label}:`)
              return false
            }
          })
        )
      }

      const unsubCreateBefore = eventBus.on(
        createEventName,
        'before',
        (data?: unknown) => {

          const { rows, cols } = extractTableCreateData(data, {
            rows: defaultRows,
            cols: defaultColumns,
          })

          if (rows < 1 || rows > maxRows) {
            logger.warn(
              `Table create blocked: rows ${rows} is outside range 1-${maxRows}`
            )
            return false
          }

          if (cols < 1 || cols > maxColumns) {
            logger.warn(
              `Table create blocked: columns ${cols} is outside range 1-${maxColumns}`
            )
            return false
          }

          return true
        }
      )

      unsubscribers.push(unsubCreateBefore)

      unsubscribers.push(
        eventBus.on(createEventName, 'on', (data?: unknown) => {
          try {
            const { rows, cols } = extractTableCreateData(data, {
              rows: defaultRows,
              cols: defaultColumns,
            })

            eventBus.emit(CoreEvents.CAPTURE_SNAPSHOT)

            const done = runModelCommand(context, insertTable(rows, cols))

            if (done) {
              eventBus.emit(CoreEvents.STYLE_CHANGED, {
                style: 'table',
                action: 'create',
                rows,
                cols,
              })
            }

            return done
          } catch (error) {
            reportError(error, 'Failed to create table:')
            return false
          }
        })
      )

      bind(
        insertRowEventName,
        'Table insert row',
        (data) =>
          extractPosition(data, 'below') === 'above'
            ? commands.addRowBefore
            : commands.addRowAfter,
        (data) => ({
          action: 'insertRow',
          position: extractPosition(data, 'below'),
        })
      )

      bind(
        deleteRowEventName,
        'Table delete row',
        () => commands.deleteRow,
        () => ({ action: 'deleteRow' })
      )

      bind(
        insertColumnEventName,
        'Table insert column',
        (data) =>
          extractPosition(data, 'right') === 'left'
            ? commands.addColumnBefore
            : commands.addColumnAfter,
        (data) => ({
          action: 'insertColumn',
          position: extractPosition(data, 'right'),
        })
      )

      bind(
        deleteColumnEventName,
        'Table delete column',
        () => commands.deleteColumn,
        () => ({ action: 'deleteColumn' })
      )

      bind(
        deleteTableEventName,
        'Table delete',
        () => commands.deleteTable,
        () => ({ action: 'delete' })
      )
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
