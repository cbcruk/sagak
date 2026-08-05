import type { ComponentChildren } from 'preact'
import { useId, useState } from 'preact/hooks'
import { Dialog, Button, Input, Label } from 'kinu'
import { Table } from 'lucide-preact'
import { ContentEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { useSelectionDerived } from '../../hooks/use-selection-derived'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

const ICON_SIZE = 18

function findTableAtSelection(): HTMLTableElement | null {
  const selection = window.getSelection()
  if (!selection || !selection.anchorNode) return null

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

const rowStyle = { display: 'flex', gap: 8 } as const

export function TableDialog(): ComponentChildren {
  const { eventBus, selectionManager } = useEditorContext()
  const [rows, setRows] = useState('3')
  const [cols, setCols] = useState('3')
  const hasTable = useSelectionDerived(() => !!findTableAtSelection(), false)
  // kinu 의 Dialog.Content 는 ref 를 DOM 으로 넘기지 않습니다 (link-dialog 참고)
  const dialogId = useId()

  /** `commandfor` 가 다이얼로그를 여는 것과 같은 클릭에서 먼저 실행됩니다 */
  const handleOpen = (): void => {
    selectionManager?.saveSelection()
    setRows('3')
    setCols('3')
  }

  /**
   * 표 편집 동작은 전부 같은 순서를 따릅니다 —
   * 다이얼로그를 닫고, 다음 프레임에 선택 영역을 되살린 뒤 이벤트를 보냅니다.
   * `emit` 을 감싸지 않고 콜백으로 받아야 이벤트 페이로드 타입이 살아 있습니다.
   */
  const closeThen = (emit: () => void): void => {
    const dialog = document.getElementById(dialogId)
    if (dialog instanceof HTMLDialogElement) {
      dialog.close()
    }
    requestAnimationFrame(() => {
      selectionManager?.restoreSelection()
      emit()
    })
  }

  const rowCount = parseInt(rows, 10)
  const colCount = parseInt(cols, 10)
  const isValidInput =
    !isNaN(rowCount) && !isNaN(colCount) && rowCount >= 1 && colCount >= 1

  const handleSubmit = (): void => {
    if (!isValidInput) return
    closeThen(() =>
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
              <Button type="button" onClick={handleSubmit} disabled={!isValidInput}>
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
                    closeThen(() =>
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
                    closeThen(() =>
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
                  onClick={() => closeThen(() => eventBus.emit(ContentEvents.TABLE_DELETE_ROW))}
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
                    closeThen(() =>
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
                    closeThen(() =>
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
                    closeThen(() =>
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
                onClick={() => closeThen(() => eventBus.emit(ContentEvents.TABLE_DELETE))}
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
