import { useState, useCallback } from 'preact/hooks'
import { FindReplaceEvents } from '@sagak/core'
import { Dialog } from './dialog'
import { useEditorContext } from '../context/editor-context'
import { useResetOnOpen } from '../hooks/use-reset-on-open'

/**
 * `FindReplaceDialog` 컴포넌트 속성
 */
export interface FindReplaceDialogProps {
  /** 다이얼로그가 열려 있는지 여부 */
  isOpen: boolean
  /** 다이얼로그가 닫혀야 할 때 콜백 */
  onClose: () => void
}

/**
 * 찾기/바꾸기 다이얼로그 컴포넌트
 *
 * @param props - `FindReplaceDialog` 속성
 * @returns `FindReplaceDialog` 컴포넌트
 *
 * @example
 * ```tsx
 * <FindReplaceDialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
export function FindReplaceDialog({ isOpen, onClose }: FindReplaceDialogProps) {
  const { eventBus } = useEditorContext()
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [matchCount, setMatchCount] = useState<number | null>(null)

  useResetOnOpen(
    isOpen,
    useCallback(() => {
      setQuery('')
      setReplacement('')
      setCaseSensitive(false)
      setWholeWord(false)
      setMatchCount(null)
    }, [])
  )

  const handleFind = () => {
    if (!query.trim()) {
      return
    }

    eventBus.emit(FindReplaceEvents.FIND, {
      query: query.trim(),
      caseSensitive,
      wholeWord,
    })
  }

  const handleFindNext = () => {
    eventBus.emit(FindReplaceEvents.FIND_NEXT)
  }

  const handleFindPrevious = () => {
    eventBus.emit(FindReplaceEvents.FIND_PREVIOUS)
  }

  const handleReplace = () => {
    if (!query.trim()) {
      return
    }

    eventBus.emit(FindReplaceEvents.REPLACE, {
      query: query.trim(),
      replacement,
      caseSensitive,
      wholeWord,
    })
  }

  const handleReplaceAll = () => {
    if (!query.trim()) {
      return
    }

    eventBus.emit(FindReplaceEvents.REPLACE_ALL, {
      query: query.trim(),
      replacement,
      caseSensitive,
      wholeWord,
    })
  }

  const handleClose = () => {
    eventBus.emit(FindReplaceEvents.CLEAR_FIND)
    onClose()
  }

  return (
    <Dialog isOpen={isOpen} title="Find & Replace" onClose={handleClose}>
      <div data-part="field">
        <label data-part="label" for="find-query">
          Find
        </label>
        <input
          id="find-query"
          type="text"
          data-part="input"
          placeholder="Search text..."
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleFind()
            }
          }}
          autoFocus
        />
      </div>

      <div data-part="field">
        <label data-part="label" for="find-replacement">
          Replace with
        </label>
        <input
          id="find-replacement"
          type="text"
          data-part="input"
          placeholder="Replacement text..."
          value={replacement}
          onInput={(e) => setReplacement((e.target as HTMLInputElement).value)}
        />
      </div>

      <div data-part="field">
        <label data-part="checkbox-label">
          <input
            type="checkbox"
            data-part="checkbox"
            checked={caseSensitive}
            onChange={(e) =>
              setCaseSensitive((e.target as HTMLInputElement).checked)
            }
          />
          Case sensitive
        </label>
      </div>

      <div data-part="field">
        <label data-part="checkbox-label">
          <input
            type="checkbox"
            data-part="checkbox"
            checked={wholeWord}
            onChange={(e) =>
              setWholeWord((e.target as HTMLInputElement).checked)
            }
          />
          Whole word
        </label>
      </div>

      {matchCount !== null && (
        <div data-part="info">
          {matchCount} match{matchCount !== 1 ? 'es' : ''} found
        </div>
      )}

      <div data-part="button-group">
        <button type="button" data-part="button" onClick={handleFind}>
          Find
        </button>
        <button type="button" data-part="button" onClick={handleFindPrevious}>
          ◀ Prev
        </button>
        <button type="button" data-part="button" onClick={handleFindNext}>
          Next ▶
        </button>
      </div>

      <div data-part="button-group">
        <button type="button" data-part="button" onClick={handleReplace}>
          Replace
        </button>
        <button type="button" data-part="button" onClick={handleReplaceAll}>
          Replace All
        </button>
      </div>
    </Dialog>
  )
}
