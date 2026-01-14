import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ContentEvents, CoreEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

function getSelectedLink(): HTMLAnchorElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  let node: Node | null = selection.anchorNode
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'A') {
      return node as HTMLAnchorElement
    }
    node = node.parentNode
  }
  return null
}

export function LinkDialog(): ReactNode {
  const { eventBus, selectionManager } = useEditorContext()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [hasLink, setHasLink] = useState(false)

  const updateLinkState = useCallback((): void => {
    const link = getSelectedLink()
    setHasLink(!!link)
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', updateLinkState)
    const unsubStyle = eventBus.on(CoreEvents.STYLE_CHANGED, 'after', updateLinkState)
    const unsubRestore = eventBus.on(CoreEvents.CONTENT_RESTORED, 'after', updateLinkState)
    return () => {
      document.removeEventListener('selectionchange', updateLinkState)
      unsubStyle()
      unsubRestore()
    }
  }, [eventBus, updateLinkState])

  const handleOpen = (): void => {
    selectionManager?.saveSelection()
    const link = getSelectedLink()
    setUrl(link?.href || '')
    setOpen(true)
  }

  const handleSubmit = (): void => {
    const trimmedUrl = url.trim()
    setOpen(false)
    if (trimmedUrl) {
      requestAnimationFrame(() => {
        selectionManager?.restoreSelection()
        eventBus.emit(ContentEvents.LINK_CHANGED, { url: trimmedUrl })
      })
    }
  }

  const handleRemove = (): void => {
    setOpen(false)
    requestAnimationFrame(() => {
      selectionManager?.restoreSelection()
      const link = getSelectedLink()
      if (link) {
        const range = document.createRange()
        range.selectNodeContents(link)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      eventBus.emit(ContentEvents.LINK_REMOVED)
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        onClick={handleOpen}
        style={{
          padding: '6px 12px',
          border: '1px solid #ccc',
          borderRadius: 4,
          background: hasLink ? '#333' : '#fff',
          color: hasLink ? '#fff' : '#333',
          cursor: 'pointer',
          marginRight: 4,
        }}
      >
        Link
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
            minWidth: 320,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          }}
        >
          <Dialog.Title style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>
            Insert Link
          </Dialog.Title>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
              URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: 4,
                fontSize: 14,
                boxSizing: 'border-box',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit()
                }
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleRemove}
              style={{
                padding: '8px 16px',
                border: '1px solid #ccc',
                borderRadius: 4,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
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
              style={{
                padding: '8px 16px',
                border: '1px solid #0066cc',
                borderRadius: 4,
                background: '#0066cc',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Insert
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
