import {
  useState,
  useEffect,
  useCallback,
  useId,
  type ReactNode,
} from 'preact/compat'
import { Dialog, Button, Input, Label, Checkbox } from 'kinu'
import { Search } from 'lucide-preact'
import { FindReplaceEvents, CoreEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

const ICON_SIZE = 18

const rowStyle = { display: 'flex', gap: 8 } as const

const checkboxLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
} as const

export function FindReplaceDialog(): ReactNode {
  const { eventBus } = useEditorContext()
  const [open, setOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const [currentMatch, setCurrentMatch] = useState(0)
  // kinu 의 Dialog.Content 는 ref 를 DOM 으로 넘기지 않습니다 (link-dialog 참고)
  const dialogId = useId()

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
    setCurrentMatch((prev) =>
      matchCount > 0 ? (prev <= 1 ? matchCount : prev - 1) : 0
    )
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

  /**
   * 네이티브 `<dialog>` 의 `close` 이벤트에 붙습니다. Esc 든 Close 버튼이든
   * 어느 경로로 닫혀도 강조 표시가 정리되도록 보장합니다.
   */
  const handleClose = useCallback((): void => {
    eventBus.emit(FindReplaceEvents.CLEAR_FIND)
    setOpen(false)
    setMatchCount(0)
    setCurrentMatch(0)
  }, [eventBus])

  useEffect(() => {
    const unsubStyle = eventBus.on(
      CoreEvents.STYLE_CHANGED,
      'after',
      (data?: unknown) => {
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
      }
    )

    return () => {
      unsubStyle()
    }
  }, [eventBus])

  useEffect(() => {
    if (open && findText.trim()) {
      handleFind()
    }
  }, [caseSensitive, wholeWord])

  const hasQuery = !!findText.trim()

  return (
    <Dialog id={dialogId}>
      <Dialog.Trigger>
        <ToolbarButton
          title="Find & Replace"
          onClick={() => setOpen(true)}
        >
          <Search size={ICON_SIZE} aria-hidden="true" />
        </ToolbarButton>
      </Dialog.Trigger>

      <Dialog.Content
        id={dialogId}
        aria-label="Find & Replace"
        onClose={handleClose}
      >
        <h2>Find &amp; Replace</h2>

        <div>
          <Label>Find</Label>
          <Input
            type="text"
            value={findText}
            onInput={(event) =>
              setFindText((event.currentTarget as HTMLInputElement).value)
            }
            onKeyDown={(event) => {
              if ((event as KeyboardEvent).key !== 'Enter') return
              event.preventDefault()
              if (matchCount > 0) {
                handleFindNext()
              } else {
                handleFind()
              }
            }}
            placeholder="Search text..."
            autoFocus
          />
        </div>

        <div>
          <Label>Replace</Label>
          <Input
            type="text"
            value={replaceText}
            onInput={(event) =>
              setReplaceText((event.currentTarget as HTMLInputElement).value)
            }
            placeholder="Replace with..."
          />
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Label style={checkboxLabelStyle}>
            <Checkbox
              checked={caseSensitive}
              onChange={(event) =>
                setCaseSensitive(
                  (event.currentTarget as HTMLInputElement).checked
                )
              }
            />
            Case sensitive
          </Label>
          <Label style={checkboxLabelStyle}>
            <Checkbox
              checked={wholeWord}
              onChange={(event) =>
                setWholeWord((event.currentTarget as HTMLInputElement).checked)
              }
            />
            Whole word
          </Label>
        </div>

        {matchCount > 0 && (
          <p>
            {currentMatch} of {matchCount} matches
          </p>
        )}

        {hasQuery && matchCount === 0 && currentMatch === 0 && (
          <p>No matches found</p>
        )}

        <div style={rowStyle}>
          <Button type="button" onClick={handleFind} disabled={!hasQuery}>
            Find
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleFindPrevious}
            disabled={matchCount === 0}
          >
            ↑ Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleFindNext}
            disabled={matchCount === 0}
          >
            ↓ Next
          </Button>
        </div>

        <div style={rowStyle}>
          <Button
            type="button"
            variant="outline"
            onClick={handleReplace}
            disabled={matchCount === 0}
          >
            Replace
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReplaceAll}
            disabled={matchCount === 0}
          >
            Replace All
          </Button>
          <Dialog.Close>
            <Button type="button" variant="outline">
              Close
            </Button>
          </Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog>
  )
}
