import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Image } from 'lucide-react'
import { ContentEvents, CoreEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const ICON_SIZE = 18

function getSelectedImage(): HTMLImageElement | null {
  const selection = window.getSelection()
  if (!selection || !selection.anchorNode) return null

  const node = selection.anchorNode

  // Case 1: anchorNode is IMG element
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as Element).tagName === 'IMG'
  ) {
    return node as HTMLImageElement
  }

  // Case 2: anchorNode is parent element, check child at offset
  if (node.nodeType === Node.ELEMENT_NODE) {
    const offset = selection.anchorOffset
    // Check node before cursor (image click places cursor after image)
    if (offset > 0) {
      const prevChild = node.childNodes[offset - 1]
      if (
        prevChild?.nodeType === Node.ELEMENT_NODE &&
        (prevChild as Element).tagName === 'IMG'
      ) {
        return prevChild as HTMLImageElement
      }
    }
    // Check node at cursor
    const childAtOffset = node.childNodes[offset]
    if (
      childAtOffset?.nodeType === Node.ELEMENT_NODE &&
      (childAtOffset as Element).tagName === 'IMG'
    ) {
      return childAtOffset as HTMLImageElement
    }
  }

  // Case 3: anchorNode is text node, check siblings
  if (node.nodeType === Node.TEXT_NODE) {
    const prev = node.previousSibling
    if (
      prev?.nodeType === Node.ELEMENT_NODE &&
      (prev as Element).tagName === 'IMG'
    ) {
      return prev as HTMLImageElement
    }
    const next = node.nextSibling
    if (
      next?.nodeType === Node.ELEMENT_NODE &&
      (next as Element).tagName === 'IMG'
    ) {
      return next as HTMLImageElement
    }
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

export function ImageDialog(): ReactNode {
  const { eventBus, selectionManager } = useEditorContext()
  const [open, setOpen] = useState(false)
  const [src, setSrc] = useState('')
  const [alt, setAlt] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const updateImageState = useCallback((): void => {
    const img = getSelectedImage()
    setHasImage(!!img)
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', updateImageState)
    const unsubStyle = eventBus.on(
      CoreEvents.STYLE_CHANGED,
      'after',
      updateImageState
    )
    const unsubRestore = eventBus.on(
      CoreEvents.CONTENT_RESTORED,
      'after',
      updateImageState
    )
    return () => {
      document.removeEventListener('selectionchange', updateImageState)
      unsubStyle()
      unsubRestore()
    }
  }, [eventBus, updateImageState])

  const handleOpen = (): void => {
    selectionManager?.saveSelection()
    const img = getSelectedImage()
    if (img) {
      setSrc(img.src)
      setAlt(img.alt || '')
      setWidth(img.style.width || '')
      setHeight(img.style.height || '')
      setIsEditing(true)
    } else {
      setSrc('')
      setAlt('')
      setWidth('')
      setHeight('')
      setIsEditing(false)
    }
    setOpen(true)
  }

  const handleSubmit = (): void => {
    const trimmedSrc = src.trim()
    setOpen(false)
    if (trimmedSrc) {
      requestAnimationFrame(() => {
        selectionManager?.restoreSelection()
        if (isEditing) {
          eventBus.emit(ContentEvents.IMAGE_UPDATE, {
            src: trimmedSrc,
            alt: alt.trim(),
            width: width.trim() || undefined,
            height: height.trim() || undefined,
          })
        } else {
          eventBus.emit(ContentEvents.IMAGE_INSERT, {
            src: trimmedSrc,
            alt: alt.trim(),
            width: width.trim() || undefined,
            height: height.trim() || undefined,
          })
        }
      })
    }
  }

  const handleDelete = (): void => {
    setOpen(false)
    requestAnimationFrame(() => {
      selectionManager?.restoreSelection()
      eventBus.emit(ContentEvents.IMAGE_DELETE)
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        onClick={handleOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 26,
          border: '1px solid #d4d4d4',
          borderRadius: 6,
          background: hasImage ? '#e8f0fe' : '#fff',
          color: '#333',
          cursor: 'pointer',
        }}
        title="Insert Image"
      >
        <Image size={ICON_SIZE} />
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
            minWidth: 360,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          }}
        >
          <Dialog.Title
            style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}
          >
            {isEditing ? 'Edit Image' : 'Insert Image'}
          </Dialog.Title>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Image URL *</label>
            <input
              type="text"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              placeholder="https://example.com/image.jpg"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Alt Text</label>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Image description"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Width</label>
              <input
                type="text"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="300px or 50%"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Height</label>
              <input
                type="text"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="auto"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #dc3545',
                  borderRadius: 4,
                  background: '#fff',
                  color: '#dc3545',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            )}
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
              disabled={!src.trim()}
              style={{
                padding: '8px 16px',
                border: '1px solid #0066cc',
                borderRadius: 4,
                background: src.trim() ? '#0066cc' : '#ccc',
                color: '#fff',
                cursor: src.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {isEditing ? 'Update' : 'Insert'}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
