import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ContentEvents, CoreEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

function findTableAtSelection(): HTMLTableElement | null {
  const selection = window.getSelection()
  if (!selection || !selection.anchorNode) return null

  let node: Node | null = selection.anchorNode

  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'TABLE') {
      return node as HTMLTableElement
    }
    node = node.parentNode
  }

  return null
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #ccc',
  borderRadius: 4,
  fontSize: 14,
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 14,
}

export function TableDialog(): ReactNode {
  const { eventBus, selectionManager } = useEditorContext()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState('3')
  const [cols, setCols] = useState('3')
  const [hasTable, setHasTable] = useState(false)

  const updateTableState = useCallback((): void => {
    const table = findTableAtSelection()
    setHasTable(!!table)
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', updateTableState)
    const unsubStyle = eventBus.on(CoreEvents.STYLE_CHANGED, 'after', updateTableState)
    const unsubRestore = eventBus.on(CoreEvents.CONTENT_RESTORED, 'after', updateTableState)
    return () => {
      document.removeEventListener('selectionchange', updateTableState)
      unsubStyle()
      unsubRestore()
    }
  }, [eventBus, updateTableState])

  const handleOpen = (): void => {
    selectionManager?.saveSelection()
    setRows('3')
    setCols('3')
    setOpen(true)
  }

  const handleSubmit = (): void => {
    const rowCount = parseInt(rows, 10)
    const colCount = parseInt(cols, 10)

    if (isNaN(rowCount) || isNaN(colCount) || rowCount < 1 || colCount < 1) {
      return
    }

    setOpen(false)
    requestAnimationFrame(() => {
      selectionManager?.restoreSelection()
      eventBus.emit(ContentEvents.TABLE_CREATE, {
        rows: rowCount,
        cols: colCount,
      })
    })
  }

  const handleDelete = (): void => {
    setOpen(false)
    requestAnimationFrame(() => {
      selectionManager?.restoreSelection()
      eventBus.emit(ContentEvents.TABLE_DELETE)
    })
  }

  const isValidInput = (): boolean => {
    const rowCount = parseInt(rows, 10)
    const colCount = parseInt(cols, 10)
    return !isNaN(rowCount) && !isNaN(colCount) && rowCount >= 1 && colCount >= 1
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        onClick={handleOpen}
        style={{
          padding: '6px 12px',
          border: '1px solid #ccc',
          borderRadius: 4,
          background: hasTable ? '#333' : '#fff',
          color: hasTable ? '#fff' : '#333',
          cursor: 'pointer',
          marginRight: 4,
        }}
      >
        Table
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
          }}
        />
        <Dialog.Popup
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            minWidth: 300,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          }}
        >
          <Dialog.Title style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>
            {hasTable ? 'Edit Table' : 'Insert Table'}
          </Dialog.Title>

          {!hasTable && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Rows</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={rows}
                    onChange={(e) => setRows(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Columns</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={cols}
                    onChange={(e) => setCols(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Dialog.Close
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </Dialog.Close>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isValidInput()}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #0066cc',
                    borderRadius: 4,
                    background: isValidInput() ? '#0066cc' : '#ccc',
                    color: '#fff',
                    cursor: isValidInput() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Insert
                </button>
              </div>
            </>
          )}

          {hasTable && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Dialog.Close
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </Dialog.Close>
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #dc3545',
                  borderRadius: 4,
                  background: '#dc3545',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Delete Table
              </button>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
