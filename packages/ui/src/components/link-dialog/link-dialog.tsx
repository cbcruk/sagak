import type { ComponentChildren } from 'preact'
import { useCallback, useEffect, useId, useState } from 'preact/hooks'
import { Dialog, Button, Input } from 'kinu'
import { Link } from 'lucide-preact'
import { ContentEvents, CoreEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
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
  const { eventBus, selectionManager } = useEditorContext()
  const [url, setUrl] = useState('')
  const [hasLink, setHasLink] = useState(false)
  // kinu 의 Dialog.Content 는 함수 컴포넌트라 ref 가 DOM 으로 전달되지 않습니다.
  // 명시적 id 를 주고 그 id 로 <dialog> 핸들을 얻습니다.
  const dialogId = useId()

  const updateLinkState = useCallback((): void => {
    setHasLink(!!getSelectedLink())
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', updateLinkState)
    const unsubStyle = eventBus.on(
      CoreEvents.STYLE_CHANGED,
      'after',
      updateLinkState
    )
    const unsubRestore = eventBus.on(
      CoreEvents.CONTENT_RESTORED,
      'after',
      updateLinkState
    )
    return () => {
      document.removeEventListener('selectionchange', updateLinkState)
      unsubStyle()
      unsubRestore()
    }
  }, [eventBus, updateLinkState])

  /**
   * `commandfor` 가 다이얼로그를 여는 것과 같은 클릭에서 실행됩니다.
   * 선택 영역 저장과 URL 미리 채우기는 열리기 전에 끝나야 합니다.
   */
  const handleOpen = (): void => {
    selectionManager?.saveSelection()
    setUrl(getSelectedLink()?.href ?? '')
  }

  const close = (): void => {
    const dialog = document.getElementById(dialogId)
    if (dialog instanceof HTMLDialogElement) {
      dialog.close()
    }
  }

  const handleSubmit = (): void => {
    const trimmedUrl = url.trim()
    close()
    if (trimmedUrl) {
      requestAnimationFrame(() => {
        selectionManager?.restoreSelection()
        eventBus.emit(ContentEvents.LINK_CHANGED, { url: trimmedUrl })
      })
    }
  }

  const handleRemove = (): void => {
    close()
    requestAnimationFrame(() => {
      selectionManager?.restoreSelection()
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
