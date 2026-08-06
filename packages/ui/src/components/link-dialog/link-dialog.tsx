import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { Dialog, Button, Input } from 'kinu'
import { Link } from 'lucide-preact'
import { ContentEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { useDialogHandle } from '../../hooks/use-dialog-handle'
import { useSelectionDerived } from '../../hooks/use-selection-derived'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

const ICON_SIZE = 18

function getSelectedLink(): HTMLAnchorElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  let node: Node | null = selection.anchorNode
  while (node) {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).tagName === 'A'
    ) {
      return node as HTMLAnchorElement
    }
    node = node.parentNode
  }
  return null
}

export function LinkDialog(): ComponentChildren {
  const { eventBus } = useEditorContext()
  const [url, setUrl] = useState('')
  const hasLink = useSelectionDerived(() => !!getSelectedLink(), false)
  const { id: dialogId, save, close, restoreThen } = useDialogHandle()

  /**
   * `commandfor` 가 다이얼로그를 여는 것과 같은 클릭에서 실행됩니다.
   * 선택 영역 저장과 URL 미리 채우기는 열리기 전에 끝나야 합니다.
   */
  const handleOpen = (): void => {
    save()
    setUrl(getSelectedLink()?.href ?? '')
  }

  const handleSubmit = (): void => {
    const trimmedUrl = url.trim()
    // URL 이 비어 있어도 닫기는 합니다
    if (!trimmedUrl) {
      close()
      return
    }
    restoreThen(() =>
      eventBus.emit(ContentEvents.LINK_CHANGED, { url: trimmedUrl })
    )
  }

  const handleRemove = (): void => {
    restoreThen(() => {
      // 링크 전체를 선택 영역으로 잡아야 코어가 그 범위를 풀 수 있습니다
      const link = getSelectedLink()
      if (link) {
        const range = document.createRange()
        range.selectNodeContents(link)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      eventBus.emit(ContentEvents.LINK_REMOVED)
    })
  }

  return (
    <Dialog id={dialogId}>
      {/* Trigger 는 자체 요소를 만들지 않고 자식에 commandfor/command 를 얹습니다 */}
      <Dialog.Trigger>
        <ToolbarButton
          title="Insert Link"
          onClick={handleOpen}
          state={hasLink ? 'on' : undefined}
        >
          <Link size={ICON_SIZE} aria-hidden="true" />
        </ToolbarButton>
      </Dialog.Trigger>

      <Dialog.Content id={dialogId} aria-label="Insert Link">
        <h2>Insert Link</h2>

        <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
          URL
        </label>
        <Input
          type="text"
          value={url}
          onInput={(e) => setUrl((e.currentTarget as HTMLInputElement).value)}
          placeholder="https://example.com"
          onKeyDown={(e) => {
            if ((e as KeyboardEvent).key === 'Enter') handleSubmit()
          }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button type="button" onClick={handleRemove}>
            Remove
          </Button>
          <Dialog.Close>
            <Button type="button">Cancel</Button>
          </Dialog.Close>
          <Button type="button" onClick={handleSubmit}>
            Insert
          </Button>
        </div>
      </Dialog.Content>
    </Dialog>
  )
}
