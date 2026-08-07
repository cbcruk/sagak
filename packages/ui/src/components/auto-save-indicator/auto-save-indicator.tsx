import type { ComponentChildren, JSX } from 'preact'
import { Cloud, CloudOff, Loader2, Check, AlertCircle } from 'lucide-preact'
import { useAutoSave } from '../../hooks'

const ICON_SIZE = 14

/**
 * 저장된 초안을 버리는 버튼.
 *
 * `useAutoSave().clear()` 는 예전부터 있었지만 **어디에도 노출되지
 * 않았습니다.** 초안이 한 번 저장되면 사용자가 그것을 지울 방법이 없었습니다.
 *
 * **무엇을 하는지 정확히.** 저장소만 비웁니다 — 편집 중인 글은 그대로 남고,
 * 다음 입력에서 자동 저장이 다시 씁니다. 그래서 "글을 되돌린다" 가 아니라
 * "저장된 초안을 버린다" 이고, 쓸모가 있는 순간은 *다음에 열었을 때 이 초안이
 * 되살아나지 않게 하고 싶을 때* 입니다. 문구와 툴팁을 그에 맞췄습니다.
 */
const discardStyle: JSX.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '0 2px',
  font: 'inherit',
  fontSize: 12,
  color: 'var(--sagak-chrome-muted-fg)',
  cursor: 'pointer',
  textDecoration: 'underline',
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export interface AutoSaveIndicatorProps {
  showTime?: boolean
}

export function AutoSaveIndicator({
  showTime = true,
}: AutoSaveIndicatorProps): ComponentChildren {
  const { status, lastSaved, clear } = useAutoSave()

  const getStatusDisplay = (): {
    icon: ComponentChildren
    text: string
    color: string
  } => {
    switch (status) {
      case 'pending':
        return {
          icon: <Cloud size={ICON_SIZE} />,
          text: 'Unsaved changes',
          color: 'var(--sagak-chrome-muted-fg)',
        }
      case 'saving':
        return {
          icon: <Loader2 size={ICON_SIZE} className="animate-spin" />,
          text: 'Saving...',
          color: '#3b82f6',
        }
      case 'saved':
        return {
          icon: <Check size={ICON_SIZE} />,
          text:
            showTime && lastSaved
              ? `Saved at ${formatTime(lastSaved)}`
              : 'Saved',
          color: '#22c55e',
        }
      case 'error':
        return {
          icon: <AlertCircle size={ICON_SIZE} />,
          text: 'Save failed',
          color: '#ef4444',
        }
      case 'idle':
      default:
        return {
          icon: <CloudOff size={ICON_SIZE} />,
          text: '',
          color: 'var(--sagak-chrome-muted-fg)',
        }
    }
  }

  const { icon, text, color } = getStatusDisplay()

  if (status === 'idle' && !lastSaved) {
    return null
  }

  return (
    <div
      data-scope="auto-save"
      data-part="indicator"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color,
      }}
    >
      {icon}
      {text && <span>{text}</span>}
      {lastSaved && (
        <button
          type="button"
          onClick={clear}
          style={discardStyle}
          title="Deletes the saved draft so it won't be restored next time. Your current text stays as it is, and editing saves again."
        >
          Discard draft
        </button>
      )}
    </div>
  )
}
