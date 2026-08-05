import type { ComponentChildren } from 'preact'
import { Cloud, CloudOff, Loader2, Check, AlertCircle } from 'lucide-preact'
import { useAutoSave } from '../../hooks'

const ICON_SIZE = 14

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export interface AutoSaveIndicatorProps {
  showTime?: boolean
}

export function AutoSaveIndicator({
  showTime = true,
}: AutoSaveIndicatorProps): ComponentChildren {
  const { status, lastSaved } = useAutoSave()

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
          text: showTime && lastSaved ? `Saved at ${formatTime(lastSaved)}` : 'Saved',
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
    </div>
  )
}
