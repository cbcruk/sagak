import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { Dialog, Button, Input, Label } from 'kinu'
import { Table } from 'lucide-preact'
import { ContentEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { useDialogHandle } from '../../hooks/use-dialog-handle'
import { useSelectionDerived } from '../../hooks/use-selection-derived'
import { ToolbarButton } from '../toolbar-button/toolbar-button'
import { findTableAtSelection } from './table-dialog.shared'

const ICON_SIZE = 18


const rowStyle = { display: 'flex', gap: 8 } as const

export function TableDialog(): ComponentChildren {
  const { eventBus } = useEditorContext()
  const [rows, setRows] = useState('3')
  const [cols, setCols] = useState('3')
  const hasTable = useSelectionDerived(() => !!findTableAtSelection(), false)
  const { id: dialogId, save, restoreThen } = useDialogHandle()

  /** `commandfor` 가 다이얼로그를 여는 것과 같은 클릭에서 먼저 실행됩니다 */
  const handleOpen = (): void => {
    save()
    setRows('3')
    setCols('3')
  }

  const rowCount = parseInt(rows, 10)
  const colCount = parseInt(cols, 10)
  const isValidInput =
    !isNaN(rowCount) && !isNaN(colCount) && rowCount >= 1 && colCount >= 1

  const handleSubmit = (): void => {
    if (!isValidInput) return
    restoreThen(() =>
      eventBus.emit(ContentEvents.TABLE_CREATE, {
        rows: rowCount,
        cols: colCount,
      })
    )
  }

  return (
    <Dialog id={dialogId}>
      <Dialog.Trigger>
        <ToolbarButton
          title="Insert Table"
          onClick={handleOpen}
          state={hasTable ? 'on' : undefined}
        >
          <Table size={ICON_SIZE} aria-hidden="true" />
        </ToolbarButton>
      </Dialog.Trigger>

      <Dialog.Content
        id={dialogId}
        aria-label={hasTable ? 'Edit Table' : 'Insert Table'}
      >
        <h2>{hasTable ? 'Edit Table' : 'Insert Table'}</h2>

        {!hasTable && (
          <>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Label>Rows</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={rows}
                  onInput={(event) =>
                    setRows((event.currentTarget as HTMLInputElement).value)
                  }
                />
              </div>
              <div style={{ flex: 1 }}>
                <Label>Columns</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={cols}
                  onInput={(event) =>
                    setCols((event.currentTarget as HTMLInputElement).value)
                  }
                />
              </div>
            </div>

            <div style={{ ...rowStyle, justifyContent: 'flex-end' }}>
              <Dialog.Close>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!isValidInput}
              >
                Insert
              </Button>
            </div>
          </>
        )}

        {hasTable && (
          <>
            <div>
              <Label>Row</Label>
              <div style={rowStyle}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    restoreThen(() =>
                      eventBus.emit(ContentEvents.TABLE_INSERT_ROW, {
                        position: 'above',
                      })
                    )
                  }
                >
                  + Above
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    restoreThen(() =>
                      eventBus.emit(ContentEvents.TABLE_INSERT_ROW, {
                        position: 'below',
                      })
                    )
                  }
                >
                  + Below
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    restoreThen(() =>
                      eventBus.emit(ContentEvents.TABLE_DELETE_ROW)
                    )
                  }
                >
                  Delete
                </Button>
              </div>
            </div>

            <div>
              <Label>Column</Label>
              <div style={rowStyle}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    restoreThen(() =>
                      eventBus.emit(ContentEvents.TABLE_INSERT_COLUMN, {
                        position: 'left',
                      })
                    )
                  }
                >
                  + Left
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    restoreThen(() =>
                      eventBus.emit(ContentEvents.TABLE_INSERT_COLUMN, {
                        position: 'right',
                      })
                    )
                  }
                >
                  + Right
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    restoreThen(() =>
                      eventBus.emit(ContentEvents.TABLE_DELETE_COLUMN)
                    )
                  }
                >
                  Delete
                </Button>
              </div>
            </div>

            <div style={{ ...rowStyle, justifyContent: 'flex-end' }}>
              <Dialog.Close>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="destructive"
                onClick={() =>
                  restoreThen(() => eventBus.emit(ContentEvents.TABLE_DELETE))
                }
              >
                Delete Table
              </Button>
            </div>
          </>
        )}
      </Dialog.Content>
    </Dialog>
  )
}
