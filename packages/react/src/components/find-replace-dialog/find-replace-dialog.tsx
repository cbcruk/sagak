import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Search } from 'lucide-react'
import { FindReplaceEvents, CoreEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const ICON_SIZE = 18

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

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  cursor: 'pointer',
}

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
}

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  border: '1px solid #0066cc',
  background: '#0066cc',
  color: '#fff',
}

export function FindReplaceDialog(): ReactNode {
  const { eventBus } = useEditorContext()
  const [open, setOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const [currentMatch, setCurrentMatch] = useState(0)

  const handleFind = useCallback((): void => {
    if (!findText.trim()) return

    eventBus.emit(FindReplaceEvents.FIND, {
      query: findText,
      caseSensitive,
      wholeWord,
    })
  }, [eventBus, findText, caseSensitive, wholeWord])

  const handleFindNext = useCallback((): void => {
    eventBus.emit(FindReplaceEvents.FIND_NEXT)
    setCurrentMatch((prev) => (matchCount > 0 ? (prev % matchCount) + 1 : 0))
  }, [eventBus, matchCount])

  const handleFindPrevious = useCallback((): void => {
    eventBus.emit(FindReplaceEvents.FIND_PREVIOUS)
    setCurrentMatch((prev) => (matchCount > 0 ? (prev <= 1 ? matchCount : prev - 1) : 0))
  }, [eventBus, matchCount])

  const handleReplace = useCallback((): void => {
    if (!findText.trim()) return

    eventBus.emit(FindReplaceEvents.REPLACE, {
      query: findText,
      replacement: replaceText,
      caseSensitive,
      wholeWord,
    })
  }, [eventBus, findText, replaceText, caseSensitive, wholeWord])

  const handleReplaceAll = useCallback((): void => {
    if (!findText.trim()) return

    eventBus.emit(FindReplaceEvents.REPLACE_ALL, {
      query: findText,
      replacement: replaceText,
      caseSensitive,
      wholeWord,
    })
  }, [eventBus, findText, replaceText, caseSensitive, wholeWord])

  const handleClose = useCallback((): void => {
    eventBus.emit(FindReplaceEvents.CLEAR_FIND)
    setOpen(false)
    setMatchCount(0)
    setCurrentMatch(0)
  }, [eventBus])

  useEffect(() => {
    const unsubStyle = eventBus.on(CoreEvents.STYLE_CHANGED, 'after', (data?: unknown) => {
      if (data && typeof data === 'object' && 'style' in data) {
        const styleData = data as Record<string, unknown>
        if (styleData.style !== 'find') return

        const action = styleData.action as string | undefined
        const count = styleData.matchCount as number | undefined

        if (action === 'find' && typeof count === 'number') {
          setMatchCount(count)
          setCurrentMatch(count > 0 ? 1 : 0)
        } else if (action === 'replace' && typeof count === 'number') {
          setMatchCount(count)
          if (count === 0) {
            setCurrentMatch(0)
          }
        } else if (action === 'replaceAll' || action === 'clear') {
          setMatchCount(0)
          setCurrentMatch(0)
        }
      }
    })

    return () => {
      unsubStyle()
    }
  }, [eventBus])

  useEffect(() => {
    if (open && findText.trim()) {
      handleFind()
    }
  }, [caseSensitive, wholeWord])

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose()
      } else {
        setOpen(true)
      }
    }}>
      <Dialog.Trigger
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 26,
          border: '1px solid #d4d4d4',
          borderRadius: 6,
          background: '#fff',
          color: '#333',
          cursor: 'pointer',
        }}
        title="Find & Replace"
      >
        <Search size={ICON_SIZE} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.3)',
          }}
        />
        <Dialog.Popup
          style={{
            position: 'fixed',
            top: 80,
            right: 20,
            background: '#fff',
            borderRadius: 8,
            padding: 20,
            minWidth: 320,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          }}
        >
          <Dialog.Title style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>
            Find & Replace
          </Dialog.Title>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Find</label>
            <input
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (matchCount > 0) {
                    handleFindNext()
                  } else {
                    handleFind()
                  }
                }
              }}
              placeholder="Search text..."
              style={inputStyle}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Replace</label>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with..."
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
              />
              Case sensitive
            </label>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={wholeWord}
                onChange={(e) => setWholeWord(e.target.checked)}
              />
              Whole word
            </label>
          </div>

          {matchCount > 0 && (
            <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
              {currentMatch} of {matchCount} matches
            </div>
          )}

          {findText.trim() && matchCount === 0 && currentMatch === 0 && (
            <div style={{ marginBottom: 12, fontSize: 13, color: '#999' }}>
              No matches found
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={handleFind}
              disabled={!findText.trim()}
              style={{
                ...primaryButtonStyle,
                opacity: findText.trim() ? 1 : 0.5,
                cursor: findText.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Find
            </button>
            <button
              type="button"
              onClick={handleFindPrevious}
              disabled={matchCount === 0}
              style={{
                ...buttonStyle,
                opacity: matchCount > 0 ? 1 : 0.5,
                cursor: matchCount > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              ↑ Prev
            </button>
            <button
              type="button"
              onClick={handleFindNext}
              disabled={matchCount === 0}
              style={{
                ...buttonStyle,
                opacity: matchCount > 0 ? 1 : 0.5,
                cursor: matchCount > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              ↓ Next
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleReplace}
              disabled={matchCount === 0}
              style={{
                ...buttonStyle,
                opacity: matchCount > 0 ? 1 : 0.5,
                cursor: matchCount > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleReplaceAll}
              disabled={matchCount === 0}
              style={{
                ...buttonStyle,
                opacity: matchCount > 0 ? 1 : 0.5,
                cursor: matchCount > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Replace All
            </button>
            <button
              type="button"
              onClick={handleClose}
              style={buttonStyle}
            >
              Close
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
