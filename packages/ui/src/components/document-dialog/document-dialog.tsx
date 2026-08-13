import type { ComponentChildren, JSX } from 'preact'
import { useState } from 'preact/hooks'
import { Dialog, Button, MenubarItem } from 'kinu'
import { useDocument } from '../../hooks'
import { useDialogHandle } from '../../hooks/use-dialog-handle'

/**
 * 문서 목록 — 열기 · 이름 바꾸기 · 지우기.
 *
 * C단계의 `Open…` 셀렉트를 대신합니다. 셀렉트로는 열 수만 있었고, 이름을
 * 바꾸거나 지울 자리가 없었습니다.
 *
 * ## 지우기를 두 번 누르게 합니다
 *
 * 문서를 지우면 되돌릴 방법이 없습니다 — 되돌리기는 편집 내용을 위한 것이지
 * 저장소를 위한 것이 아닙니다. 그래서 한 번 더 묻습니다.
 *
 * 확인 창을 따로 띄우지 않고 **그 자리에서 버튼이 바뀝니다.** 다이얼로그 위에
 * 다이얼로그를 얹으면 `<dialog>` 두 개가 겹쳐 포커스가 꼬입니다.
 */

const listStyle: JSX.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  margin: '8px 0',
  maxHeight: 280,
  overflowY: 'auto',
}

const rowStyle: JSX.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0',
}

const nameStyle: JSX.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'left',
}

const metaStyle: JSX.CSSProperties = {
  flex: 'none',
  fontSize: 12,
  color: 'var(--sagak-chrome-muted-fg)',
}

const emptyStyle: JSX.CSSProperties = {
  margin: '16px 0',
  color: 'var(--sagak-chrome-muted-fg)',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

export interface DocumentDialogProps {
  /** 이름을 받아 옵니다 — 기본은 브라우저 프롬프트입니다 */
  requestName?: (current: string) => string | null
}

const defaultRequestName = (current: string): string | null =>
  window.prompt('New name', current)

export function DocumentDialog({
  requestName = defaultRequestName,
}: DocumentDialogProps = {}): ComponentChildren {
  const { documents, refresh, open, rename, remove, name } = useDocument()
  const { id: dialogId, close } = useDialogHandle()

  /** 지우기를 한 번 눌러 확인을 기다리는 문서 */
  const [confirming, setConfirming] = useState<string | null>(null)

  const handleOpen = (): void => {
    setConfirming(null)
    void refresh()
  }

  return (
    <Dialog id={dialogId}>
      {/*
        문서 줄의 메뉴 안에 서므로 `MenubarItem` 입니다. `Dialog.Trigger` 는
        자체 요소를 만들지 않고 자식에 `commandfor`/`command` 를 얹으므로,
        그 속성이 실제 버튼까지 닿습니다 (`toolbar-button` 과 같은 이유).
      */}
      <Dialog.Trigger>
        <MenubarItem
          type="button"
          data-part="documents"
          onClick={handleOpen}
          title="Documents"
        >
          Documents…
        </MenubarItem>
      </Dialog.Trigger>

      <Dialog.Content id={dialogId} aria-label="Documents">
        <h2>Documents</h2>

        {documents.length === 0 ? (
          <p data-part="empty" style={emptyStyle}>
            No saved documents yet.
          </p>
        ) : (
          <div data-part="list" style={listStyle}>
            {documents.map((item) => (
              <div key={item.name} data-part="row" data-name={item.name}>
                <div style={rowStyle}>
                  <button
                    type="button"
                    data-part="open"
                    style={nameStyle}
                    aria-current={item.name === name ? 'true' : undefined}
                    onClick={() => {
                      close()
                      void open(item.name)
                    }}
                  >
                    {item.name}
                  </button>

                  <span data-part="meta" style={metaStyle}>
                    {formatSize(item.size)} · {formatDate(item.modifiedAt)}
                  </span>

                  <Button
                    type="button"
                    data-part="rename"
                    onClick={() => {
                      const next = requestName(item.name)
                      if (!next) return
                      void rename(item.name, next)
                    }}
                  >
                    Rename
                  </Button>

                  {confirming === item.name ? (
                    <Button
                      type="button"
                      data-part="confirm-delete"
                      onClick={() => {
                        setConfirming(null)
                        void remove(item.name)
                      }}
                    >
                      Really delete?
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      data-part="delete"
                      onClick={() => setConfirming(item.name)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Dialog.Close>
            <Button type="button">Close</Button>
          </Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog>
  )
}
