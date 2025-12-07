import { useState, useCallback } from 'preact/hooks'
import { ContentEvents } from '@sagak/core'
import { Dialog } from './dialog'
import { useEditorContext } from '../context/editor-context'
import { useResetOnOpen } from '../hooks/use-reset-on-open'

/**
 * `TableDialog` 컴포넌트 속성
 */
export interface TableDialogProps {
  /** 다이얼로그가 열려 있는지 여부 */
  isOpen: boolean
  /** 다이얼로그가 닫혀야 할 때 콜백 */
  onClose: () => void
}

/**
 * 테이블 삽입 다이얼로그 컴포넌트
 *
 * @param props - `TableDialog` 속성
 * @returns `TableDialog` 컴포넌트
 *
 * @example
 * ```tsx
 * <TableDialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
export function TableDialog({ isOpen, onClose }: TableDialogProps) {
  const { eventBus } = useEditorContext()
  const [rows, setRows] = useState('3')
  const [cols, setCols] = useState('3')

  useResetOnOpen(
    isOpen,
    useCallback(() => {
      setRows('3')
      setCols('3')
    }, [])
  )

  const handleConfirm = () => {
    const rowsNum = parseInt(rows)
    const colsNum = parseInt(cols)

    if (isNaN(rowsNum) || rowsNum < 1 || rowsNum > 100) {
      alert('Please enter a valid number of rows (1-100)')
      return
    }

    if (isNaN(colsNum) || colsNum < 1 || colsNum > 50) {
      alert('Please enter a valid number of columns (1-50)')
      return
    }

    eventBus.emit(ContentEvents.TABLE_CREATE, {
      rows: rowsNum,
      cols: colsNum,
    })
  }

  return (
    <Dialog
      isOpen={isOpen}
      title="Insert Table"
      onClose={onClose}
      onConfirm={handleConfirm}
      confirmLabel="Insert"
    >
      <div data-part="field-group">
        <div data-part="field">
          <label data-part="label" for="table-rows">
            Rows
          </label>
          <input
            id="table-rows"
            type="number"
            data-part="input"
            min="1"
            max="100"
            value={rows}
            onInput={(e) => setRows((e.target as HTMLInputElement).value)}
            autoFocus
          />
        </div>

        <div data-part="field">
          <label data-part="label" for="table-cols">
            Columns
          </label>
          <input
            id="table-cols"
            type="number"
            data-part="input"
            min="1"
            max="50"
            value={cols}
            onInput={(e) => setCols((e.target as HTMLInputElement).value)}
          />
        </div>
      </div>
    </Dialog>
  )
}
