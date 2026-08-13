import type { ComponentChildren, JSX } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { Dialog, Button, Input, Label, ToggleGroup, Toggle } from 'kinu'
import { Image, Upload, Link } from 'lucide-preact'
import { ContentEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { useDialogHandle } from '../../hooks/use-dialog-handle'
import {
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
  getSelectedImage,
} from './image-dialog.shared'
import { useSelectionDerived } from '../../hooks/use-selection-derived'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

const ICON_SIZE = 18

type UploadMode = 'url' | 'file'


const dropZoneStyle: JSX.CSSProperties = {
  border: '2px dashed var(--sagak-chrome-border)',
  borderRadius: 8,
  padding: 24,
  textAlign: 'center',
  cursor: 'pointer',
}

export function ImageDialog(): ComponentChildren {
  const { eventBus } = useEditorContext()
  const [mode, setMode] = useState<UploadMode>('url')
  const [src, setSrc] = useState('')
  const [alt, setAlt] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const hasImage = useSelectionDerived(() => !!getSelectedImage(), false)
  const [isEditing, setIsEditing] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { id: dialogId, save, close, restoreThen } = useDialogHandle()

  const resetUploadState = (): void => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadError(null)
  }

  /** `commandfor` 가 다이얼로그를 여는 것과 같은 클릭에서 먼저 실행됩니다 */
  const handleOpen = (): void => {
    save()
    const img = getSelectedImage()
    if (img) {
      setSrc(img.src)
      setAlt(img.alt || '')
      setWidth(img.style.width || '')
      setHeight(img.style.height || '')
      setIsEditing(true)
      setMode('url')
    } else {
      setSrc('')
      setAlt('')
      setWidth('')
      setHeight('')
      setIsEditing(false)
      setMode('url')
    }
    resetUploadState()
  }

  const handleFileSelect = (file: File): void => {
    setUploadError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError(
        'Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.'
      )
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError(
        `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.`
      )
      return
    }

    setSelectedFile(file)
    setAlt(file.name.replace(/\.[^/.]+$/, ''))

    const reader = new FileReader()
    reader.onload = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleFileInputChange = (
    e: JSX.TargetedEvent<HTMLInputElement, Event>
  ): void => {
    const file = e.currentTarget.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = (e: JSX.TargetedDragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: JSX.TargetedDragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleSubmit = (): void => {
    if (mode === 'file' && previewUrl) {
      restoreThen(() =>
        eventBus.emit(ContentEvents.IMAGE_INSERT, {
          src: previewUrl,
          alt: alt.trim() || selectedFile?.name,
          width: width.trim() || undefined,
          height: height.trim() || undefined,
        })
      )
      return
    }

    if (mode !== 'url') return

    const trimmedSrc = src.trim()
    // src 가 비어 있어도 닫기는 합니다
    if (!trimmedSrc) {
      close()
      return
    }

    const payload = {
      src: trimmedSrc,
      alt: alt.trim(),
      width: width.trim() || undefined,
      height: height.trim() || undefined,
    }

    restoreThen(() =>
      isEditing
        ? eventBus.emit(ContentEvents.IMAGE_UPDATE, payload)
        : eventBus.emit(ContentEvents.IMAGE_INSERT, payload)
    )
  }

  const canSubmit = (): boolean => {
    if (mode === 'url') {
      return src.trim().length > 0
    }
    return previewUrl !== null
  }

  const handleDelete = (): void => {
    restoreThen(() => eventBus.emit(ContentEvents.IMAGE_DELETE))
  }

  return (
    <Dialog id={dialogId}>
      <Dialog.Trigger>
        <ToolbarButton
          title="Insert Image"
          onClick={handleOpen}
          state={hasImage ? 'on' : undefined}
        >
          <Image size={ICON_SIZE} aria-hidden="true" />
        </ToolbarButton>
      </Dialog.Trigger>

      <Dialog.Content
        id={dialogId}
        aria-label={isEditing ? 'Edit Image' : 'Insert Image'}
      >
        <h2>{isEditing ? 'Edit Image' : 'Insert Image'}</h2>

        {!isEditing && (
          <ToggleGroup role="group" aria-label="Image source">
            <Toggle
              pressed={mode === 'url'}
              onClick={() => setMode('url')}
              type="button"
            >
              <Link size={16} />
              URL
            </Toggle>
            <Toggle
              pressed={mode === 'file'}
              onClick={() => setMode('file')}
              type="button"
            >
              <Upload size={16} />
              Upload
            </Toggle>
          </ToggleGroup>
        )}

        {mode === 'url' && (
          <div>
            <Label>Image URL *</Label>
            <Input
              type="text"
              value={src}
              onInput={(event) =>
                setSrc((event.currentTarget as HTMLInputElement).value)
              }
              placeholder="https://example.com/image.jpg"
            />
          </div>
        )}

        {mode === 'file' && !isEditing && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              style={dropZoneStyle}
            >
              {previewUrl ? (
                <div>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{ maxWidth: '100%', maxHeight: 150 }}
                  />
                  <p>{selectedFile?.name}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      resetUploadState()
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload size={32} aria-hidden="true" />
                  <p>Click to select or drag and drop</p>
                  <p>JPEG, PNG, GIF, WebP (max 5MB)</p>
                </div>
              )}
            </div>
            {uploadError && <p role="alert">{uploadError}</p>}
          </div>
        )}

        <div>
          <Label>Alt Text</Label>
          <Input
            type="text"
            value={alt}
            onInput={(event) =>
              setAlt((event.currentTarget as HTMLInputElement).value)
            }
            placeholder="Image description"
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Label>Width</Label>
            <Input
              type="text"
              value={width}
              onInput={(event) =>
                setWidth((event.currentTarget as HTMLInputElement).value)
              }
              placeholder="300px or 50%"
            />
          </div>
          <div style={{ flex: 1 }}>
            <Label>Height</Label>
            <Input
              type="text"
              value={height}
              onInput={(event) =>
                setHeight((event.currentTarget as HTMLInputElement).value)
              }
              placeholder="auto"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {isEditing && (
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <Dialog.Close>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Dialog.Close>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit()}>
            {isEditing ? 'Update' : 'Insert'}
          </Button>
        </div>
      </Dialog.Content>
    </Dialog>
  )
}
