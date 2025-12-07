import type { ComponentChildren } from 'preact'
import { useEscapeKey } from '../hooks/use-escape-key'
import { useLockBodyScroll } from '../hooks/use-lock-body-scroll'

/**
 * `Dialog` 컴포넌트 속성
 */
export interface DialogProps {
  /** 다이얼로그가 열려 있는지 여부 */
  isOpen: boolean
  /** 다이얼로그 제목 */
  title: string
  /** 다이얼로그 콘텐츠 */
  children: ComponentChildren
  /** 다이얼로그가 닫혀야 할 때 콜백 */
  onClose: () => void
  /** 확인 버튼 클릭 시 콜백 */
  onConfirm?: () => void
  /** 확인 버튼 레이블 */
  confirmLabel?: string
  /** 취소 버튼 레이블 */
  cancelLabel?: string
}

/**
 * 다이얼로그 컴포넌트
 *
 * @param props - `Dialog` 속성
 * @returns `Dialog` 컴포넌트 또는 `null`
 *
 * @example
 * ```tsx
 * <Dialog
 *   isOpen={isOpen}
 *   title="Insert Link"
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={handleInsert}
 * >
 *   <input type="text" placeholder="URL" />
 * </Dialog>
 * ```
 */
export function Dialog({
  isOpen,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
}: DialogProps) {
  useEscapeKey(onClose, isOpen)
  useLockBodyScroll(isOpen)

  if (!isOpen) {
    return null
  }

  const handleBackdropClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }

    onClose()
  }

  return (
    <div data-scope="dialog" data-part="backdrop" onClick={handleBackdropClick}>
      <div
        data-part="root"
        data-state-open={isOpen || undefined}
        role="dialog"
        aria-modal="true"
      >
        <div data-part="header">
          <h2 data-part="title">{title}</h2>
          <button
            type="button"
            data-part="close-button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div data-part="body">{children}</div>

        <div data-part="footer">
          <button type="button" data-part="cancel-button" onClick={onClose}>
            {cancelLabel}
          </button>
          {onConfirm && (
            <button
              type="button"
              data-part="confirm-button"
              onClick={handleConfirm}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
