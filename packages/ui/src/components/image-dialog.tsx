import { useState, useCallback } from 'preact/hooks'
import { ContentEvents } from '@sagak/core'
import { Dialog } from './dialog'
import { useEditorContext } from '../context/editor-context'
import { useResetOnOpen } from '../hooks/use-reset-on-open'

/**
 * `ImageDialog` 컴포넌트 속성
 */
export interface ImageDialogProps {
  /** 다이얼로그가 열려 있는지 여부 */
  isOpen: boolean
  /** 다이얼로그가 닫혀야 할 때 콜백 */
  onClose: () => void
}

/**
 * 이미지 삽입 다이얼로그 컴포넌트
 *
 * @param props - `ImageDialog` 속성
 * @returns `ImageDialog` 컴포넌트
 *
 * @example
 * ```tsx
 * <ImageDialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
export function ImageDialog({ isOpen, onClose }: ImageDialogProps) {
  const { eventBus } = useEditorContext()
  const [src, setSrc] = useState('')
  const [alt, setAlt] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')

  useResetOnOpen(
    isOpen,
    useCallback(() => {
      setSrc('')
      setAlt('')
      setWidth('')
      setHeight('')
    }, [])
  )

  const handleConfirm = () => {
    if (!src.trim()) {
      alert('Please enter an image URL')
      return
    }

    eventBus.emit(ContentEvents.IMAGE_INSERT, {
      src: src.trim(),
      alt: alt.trim() || undefined,
      width: width.trim() || undefined,
      height: height.trim() || undefined,
    })
  }

  return (
    <Dialog
      isOpen={isOpen}
      title="Insert Image"
      onClose={onClose}
      onConfirm={handleConfirm}
      confirmLabel="Insert"
    >
      <div data-part="field">
        <label data-part="label" for="image-src">
          Image URL
        </label>
        <input
          id="image-src"
          type="text"
          data-part="input"
          placeholder="https://example.com/image.jpg"
          value={src}
          onInput={(e) => setSrc((e.target as HTMLInputElement).value)}
          autoFocus
        />
      </div>

      <div data-part="field">
        <label data-part="label" for="image-alt">
          Alt Text
        </label>
        <input
          id="image-alt"
          type="text"
          data-part="input"
          placeholder="Description of image"
          value={alt}
          onInput={(e) => setAlt((e.target as HTMLInputElement).value)}
        />
      </div>

      <div data-part="field-group">
        <div data-part="field">
          <label data-part="label" for="image-width">
            Width
          </label>
          <input
            id="image-width"
            type="text"
            data-part="input"
            placeholder="300px"
            value={width}
            onInput={(e) => setWidth((e.target as HTMLInputElement).value)}
          />
        </div>

        <div data-part="field">
          <label data-part="label" for="image-height">
            Height
          </label>
          <input
            id="image-height"
            type="text"
            data-part="input"
            placeholder="200px"
            value={height}
            onInput={(e) => setHeight((e.target as HTMLInputElement).value)}
          />
        </div>
      </div>
    </Dialog>
  )
}
