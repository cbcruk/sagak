import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { PluginManager } from '@/core/plugin-manager'
import { SelectionManager } from '@/core/selection-manager'
import { createTablePlugin, TablePlugin } from '@/plugins/table-plugin'
import type { EditorContext } from '@/core/types'

describe('TablePlugin', () => {
  let eventBus: EventBus
  let pluginManager: PluginManager
  let selectionManager: SelectionManager
  let element: HTMLDivElement
  let context: EditorContext

  beforeEach(() => {
    // Given: 편집 가능한 요소와 에디터 컨텍스트 생성
    element = document.createElement('div')
    element.contentEditable = 'true'
    element.innerHTML = '<p>Hello World</p>'
    document.body.appendChild(element)

    eventBus = new EventBus()
    selectionManager = new SelectionManager(element)
    context = {
      eventBus,
      selectionManager,
      config: {},
    }
    pluginManager = new PluginManager(context)

    // 선택 영역을 요소로 설정
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(true)
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  describe('플러그인 등록 (기본 초기화)', () => {
    /**
     * Why: TablePlugin이 올바르게 등록되고 초기화되는지 확인
     * How: `PluginManager`에 플러그인을 등록하고 존재 여부를 검증
     */

    it('TablePlugin', async () => {
      // Given: PluginManager 준비됨

      // When: TablePlugin을 등록
      await pluginManager.register(TablePlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('content:table')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션 준비
      const customPlugin = createTablePlugin({
        defaultRows: 5,
        defaultColumns: 5,
        maxRows: 50,
        maxColumns: 25,
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('content:table')).toBe(true)
    })
  })

  describe('Table creation', () => {
    /**
     * Why: 사용자가 에디터에 표를 삽입할 수 있어야 함
     * How: `TABLE_CREATE` 이벤트 발행 시 DOM에 `<table>` 요소를 생성하고
     *      `STYLE_CHANGED` 이벤트를 발행
     */

    beforeEach(async () => {
      // Given: TablePlugin 등록됨
      await pluginManager.register(TablePlugin)
    })

    it('should create table with default dimensions', () => {
      // Given: 이벤트 리스너 준비
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: TABLE_CREATE 이벤트 발행
      const result = eventBus.emit('TABLE_CREATE')

      // Then: 기본 크기 표가 생성되고 이벤트가 발행되어야 함
      expect(result).toBe(true)
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'table',
        action: 'create',
        rows: 3,
        cols: 3,
      })

      const table = element.querySelector('table')
      expect(table).toBeTruthy()
      expect(table?.querySelectorAll('tr').length).toBe(3)
      expect(table?.querySelector('tr')?.querySelectorAll('td').length).toBe(3)

      vi.restoreAllMocks()
    })

    it('should create table with specified dimensions', () => {
      // Given: 이벤트 리스너 준비
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 지정된 크기로 TABLE_CREATE 이벤트 발행
      const result = eventBus.emit('TABLE_CREATE', { rows: 5, cols: 4 })

      // Then: 지정된 크기 표가 생성되어야 함
      expect(result).toBe(true)
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'table',
        action: 'create',
        rows: 5,
        cols: 4,
      })

      const table = element.querySelector('table')
      expect(table?.querySelectorAll('tr').length).toBe(5)
      expect(table?.querySelector('tr')?.querySelectorAll('td').length).toBe(4)

      vi.restoreAllMocks()
    })

    it('should create table with custom border and width', () => {
      // Given: 테두리와 너비가 지정된 옵션 준비

      // When: TABLE_CREATE 이벤트 발행
      eventBus.emit('TABLE_CREATE', {
        rows: 2,
        cols: 2,
        border: '2',
        width: '50%',
      })

      // Then: 테두리와 너비가 적용되어야 함
      const table = element.querySelector('table') as HTMLTableElement
      expect(table).toBeTruthy()
      expect(table.border).toBe('2')
      expect(table.style.width).toBe('50%')
    })

    it('should reject table with invalid dimensions', () => {
      // Given: console.warn spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 최대 행 수를 초과하는 크기로 이벤트 발행
      let result = eventBus.emit('TABLE_CREATE', { rows: 150, cols: 3 })
      expect(result).toBe(false)

      // When: 최대 열 수를 초과하는 크기로 이벤트 발행
      result = eventBus.emit('TABLE_CREATE', { rows: 3, cols: 100 })
      expect(result).toBe(false)

      // Then: 경고가 출력되어야 함
      expect(consoleWarn).toHaveBeenCalledTimes(2)

      consoleWarn.mockRestore()
    })

    it('should move cursor to first cell after creation', () => {
      // Given: TABLE_CREATE 이벤트 발행
      eventBus.emit('TABLE_CREATE', { rows: 2, cols: 2 })

      // When: 선택 영역 확인
      const selection = window.getSelection()
      expect(selection).toBeTruthy()

      const table = element.querySelector('table')
      const firstCell = table?.querySelector('td')
      expect(firstCell).toBeTruthy()

      // Then: 커서가 첫 번째 셀에 있어야 함
      let node = selection?.anchorNode
      let foundCell = false
      while (node && node !== element) {
        if (node === firstCell) {
          foundCell = true
          break
        }
        node = node.parentNode
      }
      expect(foundCell).toBe(true)
    })
  })

  describe('Row operations', () => {
    /**
     * Why: 사용자가 표에서 행을 추가/삭제할 수 있어야 함
     * How: `TABLE_INSERT_ROW`, `TABLE_DELETE_ROW` 이벤트 발행 시
     *      현재 행 기준으로 행을 추가/삭제하고, 마지막 행은 삭제를 차단
     */

    beforeEach(async () => {
      // Given: TablePlugin 등록되고 표 생성됨
      await pluginManager.register(TablePlugin)
      eventBus.emit('TABLE_CREATE', { rows: 3, cols: 3 })
    })

    it('should insert row below current row', () => {
      // Given: 현재 행 수 확인
      const table = element.querySelector('table')
      const initialRowCount = table?.querySelectorAll('tr').length

      // When: TABLE_INSERT_ROW 이벤트 발행
      const result = eventBus.emit('TABLE_INSERT_ROW', { position: 'below' })

      // Then: 행이 추가되어야 함
      expect(result).toBe(true)
      expect(table?.querySelectorAll('tr').length).toBe(
        (initialRowCount || 0) + 1
      )
    })

    it('should insert row above current row', () => {
      // Given: 현재 행 수 확인
      const table = element.querySelector('table')
      const initialRowCount = table?.querySelectorAll('tr').length

      // When: TABLE_INSERT_ROW 이벤트 발행
      const result = eventBus.emit('TABLE_INSERT_ROW', { position: 'above' })

      // Then: 행이 추가되어야 함
      expect(result).toBe(true)
      expect(table?.querySelectorAll('tr').length).toBe(
        (initialRowCount || 0) + 1
      )
    })

    it('should delete current row', () => {
      // Given: 현재 행 수 확인
      const table = element.querySelector('table')
      const initialRowCount = table?.querySelectorAll('tr').length

      // When: TABLE_DELETE_ROW 이벤트 발행
      const result = eventBus.emit('TABLE_DELETE_ROW')

      // Then: 행이 삭제되어야 함
      expect(result).toBe(true)
      expect(table?.querySelectorAll('tr').length).toBe(
        (initialRowCount || 0) - 1
      )
    })

    it('should not delete last row', () => {
      // Given: console.warn spy 준비, 셀 선택 헬퍼 함수
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const table = element.querySelector('table')

      const selectFirstCell = () => {
        const cell = table?.querySelector('td')
        if (cell) {
          const range = document.createRange()
          range.selectNodeContents(cell)
          range.collapse(true)
          const selection = window.getSelection()
          if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }
      }

      // When: 마지막 행까지 삭제 시도
      selectFirstCell()
      eventBus.emit('TABLE_DELETE_ROW')
      selectFirstCell()
      eventBus.emit('TABLE_DELETE_ROW')

      selectFirstCell()
      const result = eventBus.emit('TABLE_DELETE_ROW')

      // Then: 마지막 행 삭제가 차단되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Cannot delete last row in table'
      )

      consoleWarn.mockRestore()
    })

    it('should emit STYLE_CHANGED after row insertion', () => {
      // Given: 이벤트 리스너 준비
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: TABLE_INSERT_ROW 이벤트 발행
      eventBus.emit('TABLE_INSERT_ROW', { position: 'below' })

      // Then: STYLE_CHANGED 이벤트가 발행되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          style: 'table',
          action: 'insertRow',
          position: 'below',
        })
      )

      vi.restoreAllMocks()
    })
  })

  describe('Column operations', () => {
    /**
     * Why: 사용자가 표에서 열을 추가/삭제할 수 있어야 함
     * How: `TABLE_INSERT_COLUMN`, `TABLE_DELETE_COLUMN` 이벤트 발행 시
     *      현재 열 기준으로 열을 추가/삭제하고, 마지막 열은 삭제를 차단
     */

    beforeEach(async () => {
      // Given: TablePlugin 등록되고 표 생성됨
      await pluginManager.register(TablePlugin)
      eventBus.emit('TABLE_CREATE', { rows: 3, cols: 3 })
    })

    it('should insert column to the right', () => {
      // Given: 현재 열 수 확인
      const table = element.querySelector('table')
      const initialColCount = table
        ?.querySelector('tr')
        ?.querySelectorAll('td').length

      // When: TABLE_INSERT_COLUMN 이벤트 발행
      const result = eventBus.emit('TABLE_INSERT_COLUMN', { position: 'right' })

      // Then: 열이 추가되어야 함
      expect(result).toBe(true)
      expect(table?.querySelector('tr')?.querySelectorAll('td').length).toBe(
        (initialColCount || 0) + 1
      )
    })

    it('should insert column to the left', () => {
      // Given: 현재 열 수 확인
      const table = element.querySelector('table')
      const initialColCount = table
        ?.querySelector('tr')
        ?.querySelectorAll('td').length

      // When: TABLE_INSERT_COLUMN 이벤트 발행
      const result = eventBus.emit('TABLE_INSERT_COLUMN', { position: 'left' })

      // Then: 열이 추가되어야 함
      expect(result).toBe(true)
      expect(table?.querySelector('tr')?.querySelectorAll('td').length).toBe(
        (initialColCount || 0) + 1
      )
    })

    it('should delete current column', () => {
      // Given: 현재 열 수 확인
      const table = element.querySelector('table')
      const initialColCount = table
        ?.querySelector('tr')
        ?.querySelectorAll('td').length

      // When: TABLE_DELETE_COLUMN 이벤트 발행
      const result = eventBus.emit('TABLE_DELETE_COLUMN')

      // Then: 열이 삭제되어야 함
      expect(result).toBe(true)
      expect(table?.querySelector('tr')?.querySelectorAll('td').length).toBe(
        (initialColCount || 0) - 1
      )
    })

    it('should not delete last column', () => {
      // Given: console.warn spy 준비, 셀 선택 헬퍼 함수
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const table = element.querySelector('table')

      const selectFirstCell = () => {
        const cell = table?.querySelector('td')
        if (cell) {
          const range = document.createRange()
          range.selectNodeContents(cell)
          range.collapse(true)
          const selection = window.getSelection()
          if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }
      }

      // When: 마지막 열까지 삭제 시도
      selectFirstCell()
      eventBus.emit('TABLE_DELETE_COLUMN')
      selectFirstCell()
      eventBus.emit('TABLE_DELETE_COLUMN')

      selectFirstCell()
      const result = eventBus.emit('TABLE_DELETE_COLUMN')

      // Then: 마지막 열 삭제가 차단되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Cannot delete last column in table'
      )

      consoleWarn.mockRestore()
    })

    it('should emit STYLE_CHANGED after column insertion', () => {
      // Given: 이벤트 리스너 준비
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: TABLE_INSERT_COLUMN 이벤트 발행
      eventBus.emit('TABLE_INSERT_COLUMN', { position: 'right' })

      // Then: STYLE_CHANGED 이벤트가 발행되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          style: 'table',
          action: 'insertColumn',
          position: 'right',
        })
      )

      vi.restoreAllMocks()
    })
  })

  describe('Table deletion', () => {
    /**
     * Why: 사용자가 삽입된 표를 삭제할 수 있어야 함
     * How: 표 내부에 커서가 있을 때 `TABLE_DELETE` 이벤트 발행 시
     *      전체 `<table>` 요소를 DOM에서 제거
     */

    beforeEach(async () => {
      // Given: TablePlugin 등록됨
      await pluginManager.register(TablePlugin)
    })

    it('should delete entire table', () => {
      // Given: 표 생성 및 존재 확인
      eventBus.emit('TABLE_CREATE', { rows: 3, cols: 3 })

      let table = element.querySelector('table')
      expect(table).toBeTruthy()

      // When: TABLE_DELETE 이벤트 발행
      const result = eventBus.emit('TABLE_DELETE')

      // Then: 표가 삭제되어야 함
      expect(result).toBe(true)

      table = element.querySelector('table')
      expect(table).toBeNull()
    })

    it('should emit STYLE_CHANGED after table deletion', () => {
      // Given: 표 생성, 이벤트 리스너 준비
      eventBus.emit('TABLE_CREATE', { rows: 3, cols: 3 })

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: TABLE_DELETE 이벤트 발행
      eventBus.emit('TABLE_DELETE')

      // Then: STYLE_CHANGED 이벤트가 발행되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'table',
        action: 'delete',
      })

      vi.restoreAllMocks()
    })

    it('should fail when no table is selected', () => {
      // Given: console.warn spy 준비

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 표 없이 TABLE_DELETE 이벤트 발행
      const result = eventBus.emit('TABLE_DELETE')

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Table delete blocked: No table selected'
      )

      consoleWarn.mockRestore()
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: 한글, 일본어 등 조합 문자 입력 중 표 조작을 방지해야 함
     * How: `SelectionManager.getIsComposing()`으로 조합 상태를 확인하고 차단
     */

    beforeEach(async () => {
      // Given: TablePlugin 등록됨
      await pluginManager.register(TablePlugin)
    })

    it('should block table creation during IME composition', () => {
      // Given: console.warn spy 준비, IME 조합 시작
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 조합 중 TABLE_CREATE 이벤트 발행
      const result = eventBus.emit('TABLE_CREATE', { rows: 3, cols: 3 })

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Table create blocked: IME composition in progress'
      )

      consoleWarn.mockRestore()
    })

    it('should block table operations during IME composition', () => {
      // Given: 표 생성, console.warn spy 준비, IME 조합 시작
      eventBus.emit('TABLE_CREATE', { rows: 3, cols: 3 })

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // When: 조합 중 표 조작 이벤트 발행
      eventBus.emit('TABLE_INSERT_ROW')
      eventBus.emit('TABLE_DELETE_ROW')
      eventBus.emit('TABLE_INSERT_COLUMN')
      eventBus.emit('TABLE_DELETE_COLUMN')
      eventBus.emit('TABLE_DELETE')

      // Then: 모든 조작이 차단되고 경고가 출력되어야 함
      expect(consoleWarn).toHaveBeenCalledTimes(5)

      consoleWarn.mockRestore()
    })

    it('should allow table operations after composition ends', () => {
      // Given: 표 생성, IME 조합 시작 후 종료
      eventBus.emit('TABLE_CREATE', { rows: 3, cols: 3 })

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 조합 종료 후 TABLE_INSERT_ROW 이벤트 발행
      const result = eventBus.emit('TABLE_INSERT_ROW')

      // Then: 정상 동작해야 함
      expect(result).toBe(true)
    })
  })

  describe('에러 처리 (예외 상황 대응)', () => {
    /**
     * Why: 표가 없는 상태에서 표 조작 시도 시 에러를 명확히 알려야 함
     * How: 커서가 표 외부에 있을 때 표 조작 이벤트를 차단하고 경고 출력
     */

    beforeEach(async () => {
      // Given: TablePlugin 등록됨
      await pluginManager.register(TablePlugin)
    })

    it('should fail row operations when cursor is not in table', () => {
      // Given: console.warn spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 표 없이 행 삽입 시도
      let result = eventBus.emit('TABLE_INSERT_ROW')
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Table insert row blocked: No table cell selected'
      )

      // When: 표 없이 행 삭제 시도
      result = eventBus.emit('TABLE_DELETE_ROW')
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Table delete row blocked: No table cell selected'
      )

      consoleWarn.mockRestore()
    })

    it('should fail column operations when cursor is not in table', () => {
      // Given: console.warn spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 표 없이 열 삽입 시도
      let result = eventBus.emit('TABLE_INSERT_COLUMN')
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Table insert column blocked: No table cell selected'
      )

      // When: 표 없이 열 삭제 시도
      result = eventBus.emit('TABLE_DELETE_COLUMN')
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Table delete column blocked: No table cell selected'
      )

      consoleWarn.mockRestore()
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인 정리 시 이벤트 핸들러가 해제되어야 함
     * How: `destroy()` 호출 후 이벤트가 처리되지 않는지 확인
     */

    it('destroy 시 정리를 수행해야 함', async () => {
      // Given: TablePlugin 등록되고 동작 확인
      await pluginManager.register(TablePlugin)

      let result = eventBus.emit('TABLE_CREATE', { rows: 3, cols: 3 })
      expect(result).toBe(true)

      // When: 플러그인 정리
      pluginManager.destroyAll()

      // Then: 이벤트가 처리되지 않아야 함
      result = eventBus.emit('TABLE_CREATE', { rows: 3, cols: 3 })
      const tables = element.querySelectorAll('table')
      expect(tables.length).toBe(1)
    })
  })

  describe('실제 시나리오 (사용자 동작 시뮬레이션)', () => {
    /**
     * Why: 실제 사용자의 표 생성/편집/삭제 워크플로우를 검증
     * How: 표 생성 후 행/열 추가/삭제, 전체 표 삭제 등 다양한 시나리오를 테스트
     */

    beforeEach(async () => {
      // Given: TablePlugin 등록됨
      await pluginManager.register(TablePlugin)
    })

    it('should create a simple 3x3 table', () => {
      // Given: TablePlugin 등록됨

      // When: 기본 표 생성
      eventBus.emit('TABLE_CREATE')

      // Then: 3x3 표가 생성되어야 함
      const table = element.querySelector('table')
      expect(table).toBeTruthy()
      expect(table?.querySelectorAll('tr').length).toBe(3)
      expect(table?.querySelector('tr')?.querySelectorAll('td').length).toBe(3)
    })

    it('should build a table by adding rows and columns', () => {
      // Given: 2x2 표 생성
      eventBus.emit('TABLE_CREATE', { rows: 2, cols: 2 })

      // When: 행과 열 추가
      eventBus.emit('TABLE_INSERT_ROW', { position: 'below' })
      eventBus.emit('TABLE_INSERT_COLUMN', { position: 'right' })

      // Then: 3x3 표가 되어야 함
      const table = element.querySelector('table')
      expect(table?.querySelectorAll('tr').length).toBe(3)
      expect(table?.querySelector('tr')?.querySelectorAll('td').length).toBe(3)
    })

    it('should remove rows and columns', () => {
      // Given: 4x4 표 생성, 셀 선택 헬퍼 함수
      eventBus.emit('TABLE_CREATE', { rows: 4, cols: 4 })

      const table = element.querySelector('table')

      const selectFirstCell = () => {
        const cell = table?.querySelector('td')
        if (cell) {
          const range = document.createRange()
          range.selectNodeContents(cell)
          range.collapse(true)
          const selection = window.getSelection()
          if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }
      }

      // When: 행과 열 삭제
      selectFirstCell()
      eventBus.emit('TABLE_DELETE_ROW')

      selectFirstCell()
      eventBus.emit('TABLE_DELETE_COLUMN')

      // Then: 3x3 표가 되어야 함
      expect(table?.querySelectorAll('tr').length).toBe(3)
      expect(table?.querySelector('tr')?.querySelectorAll('td').length).toBe(3)
    })

    it('should create, modify, and delete a table', () => {
      // Given: 표 생성
      eventBus.emit('TABLE_CREATE', { rows: 3, cols: 3 })
      expect(element.querySelector('table')).toBeTruthy()

      // When: 행과 열 추가 후 전체 표 삭제
      eventBus.emit('TABLE_INSERT_ROW')
      eventBus.emit('TABLE_INSERT_COLUMN')
      eventBus.emit('TABLE_DELETE')

      // Then: 표가 삭제되어야 함
      expect(element.querySelector('table')).toBeNull()
    })
  })
})
