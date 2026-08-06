import type { ComponentChildren } from 'preact'
import { useId, useState } from 'preact/hooks'
import { Dialog, Button, Input, Label, Checkbox } from 'kinu'
import { Search } from 'lucide-preact'
import { FindReplaceEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { useFindState } from '../../hooks/use-find-state'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

const ICON_SIZE = 18

const rowStyle = { display: 'flex', gap: 8 } as const

const checkboxLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
} as const

interface FindOptions {
  caseSensitive: boolean
  wholeWord: boolean
}

export function FindReplaceDialog(): ComponentChildren {
  const { eventBus } = useEditorContext()
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [options, setOptions] = useState<FindOptions>({
    caseSensitive: false,
    wholeWord: false,
  })
  const { matchCount, currentMatch, reset } = useFindState()
  // kinu 의 Dialog.Content 는 ref 를 DOM 으로 넘기지 않습니다 (link-dialog 참고)
  const dialogId = useId()

  /**
   * 검색 옵션은 인자로 받습니다.
   *
   * 이전에는 체크박스가 상태만 바꾸고 `useEffect` 가 그 변화를 보고 다시
   * 찾았습니다. 그러면 의존성 배열이 `[caseSensitive, wholeWord]` 로 거짓말을
   * 하게 되고(실제로는 `findText` 와 `open` 도 읽습니다), 다이얼로그가 열려
   * 있는지 확인하려고 `open` 상태까지 따로 들고 있어야 했습니다.
   *
   * 사용자 동작에 반응하는 일은 핸들러에서 합니다. 바뀐 값을 직접 넘기면
   * 렌더를 한 번 더 기다릴 필요도 없습니다.
   */
  const runFind = (override?: Partial<FindOptions>): void => {
    if (!findText.trim()) return

    eventBus.emit(FindReplaceEvents.FIND, {
      query: findText,
      ...options,
      ...override,
    })
  }

  const setOption = (patch: Partial<FindOptions>): void => {
    setOptions((prev) => ({ ...prev, ...patch }))
    runFind(patch)
  }

  const handleFindNext = (): void => {
    eventBus.emit(FindReplaceEvents.FIND_NEXT)
  }

  const handleFindPrevious = (): void => {
    eventBus.emit(FindReplaceEvents.FIND_PREVIOUS)
  }

  const handleReplace = (): void => {
    if (!findText.trim()) return
    eventBus.emit(FindReplaceEvents.REPLACE, {
      query: findText,
      replacement: replaceText,
      ...options,
    })
  }

  const handleReplaceAll = (): void => {
    if (!findText.trim()) return
    eventBus.emit(FindReplaceEvents.REPLACE_ALL, {
      query: findText,
      replacement: replaceText,
      ...options,
    })
  }

  /**
   * 네이티브 `<dialog>` 의 `close` 이벤트에 붙습니다. Esc 든 Close 버튼이든
   * 어느 경로로 닫혀도 강조 표시가 정리되도록 보장합니다.
   */
  const handleClose = (): void => {
    eventBus.emit(FindReplaceEvents.CLEAR_FIND)
    reset()
  }

  const hasQuery = !!findText.trim()

  return (
    <Dialog id={dialogId}>
      <Dialog.Trigger>
        <ToolbarButton
          title="Find & Replace"
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
                runFind()
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
              checked={options.caseSensitive}
              onChange={(event) =>
                setOption({
                  caseSensitive: (event.currentTarget as HTMLInputElement)
                    .checked,
                })
              }
            />
            Case sensitive
          </Label>
          <Label style={checkboxLabelStyle}>
            <Checkbox
              checked={options.wholeWord}
              onChange={(event) =>
                setOption({
                  wholeWord: (event.currentTarget as HTMLInputElement).checked,
                })
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
          <Button type="button" onClick={() => runFind()} disabled={!hasQuery}>
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
