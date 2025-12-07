import { useState, useCallback } from 'preact/hooks'
import { ContentEvents } from '@sagak/core'
import { Dialog } from './dialog'
import { useEditorContext } from '../context/editor-context'
import { useResetOnOpen } from '../hooks/use-reset-on-open'

/**
 * `LinkDialog` 컴포넌트 속성
 */
export interface LinkDialogProps {
  /** 다이얼로그가 열려 있는지 여부 */
  isOpen: boolean
  /** 다이얼로그가 닫혀야 할 때 콜백 */
  onClose: () => void
  /** 초기 URL 값 (편집용) */
  initialUrl?: string
  /** 초기 `target` 값 (편집용) */
  initialTarget?: string
}

/**
 * 링크 삽입 다이얼로그 컴포넌트
 *
 * @param props - `LinkDialog` 속성
 * @returns `LinkDialog` 컴포넌트
 *
 * @example
 * ```tsx
 * <LinkDialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
export function LinkDialog({
  isOpen,
  onClose,
  initialUrl = '',
  initialTarget = '',
}: LinkDialogProps) {
  const { eventBus } = useEditorContext()
  const [url, setUrl] = useState(initialUrl)
  const [openInNewWindow, setOpenInNewWindow] = useState(
    initialTarget === '_blank'
  )

  useResetOnOpen(
    isOpen,
    useCallback(() => {
      setUrl(initialUrl)
      setOpenInNewWindow(initialTarget === '_blank')
    }, [initialUrl, initialTarget])
  )

  const handleConfirm = () => {
    if (!url.trim()) {
      alert('Please enter a URL')
      return
    }

    eventBus.emit(ContentEvents.LINK_CHANGED, {
      url: url.trim(),
      target: openInNewWindow ? '_blank' : undefined,
    })
  }

  return (
    <Dialog
      isOpen={isOpen}
      title="Insert Link"
      onClose={onClose}
      onConfirm={handleConfirm}
      confirmLabel="Insert"
    >
      <div data-part="field">
        <label data-part="label" for="link-url">
          URL
        </label>
        <input
          id="link-url"
          type="text"
          data-part="input"
          placeholder="https://example.com"
          value={url}
          onInput={(e) => setUrl((e.target as HTMLInputElement).value)}
          autoFocus
        />
      </div>

      <div data-part="field">
        <label data-part="checkbox-label">
          <input
            type="checkbox"
            data-part="checkbox"
            checked={openInNewWindow}
            onChange={(e) =>
              setOpenInNewWindow((e.target as HTMLInputElement).checked)
            }
          />
          Open in new window
        </label>
      </div>
    </Dialog>
  )
}
