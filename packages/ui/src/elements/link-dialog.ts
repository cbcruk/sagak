import { define } from 'nanotags'
import { Link } from 'lucide'
import { ContentEvents } from 'sagak-core'
import type { EditorContext } from 'sagak-core'
import { editorContextKey } from './editor-context'
import { icon, toolbarButton } from './icon'
import { button, dialog, dialogSelection, input, label } from './primitives'
import { subscribeToSelection } from '../hooks/use-selection-derived'
import { getSelectedLink } from '../components/link-dialog/link-dialog.shared'

/**
 * 링크 다이얼로그 — **kinu 를 안 쓰고 만든 첫 다이얼로그**입니다.
 *
 * 2단계의 비용을 재는 자리라 가장 작은 것(115줄)으로 골랐습니다. 여기서 든
 * 품이 나머지 다이얼로그 다섯의 추정치가 됩니다.
 *
 * ## 이미 검사가 있습니다
 *
 * `toolbar.browser.test.tsx` 의 "링크를 삽입하고, 다시 열면 기존 URL 을 미리
 * 채워야 함" 이 이 컴포넌트를 지킵니다. 색 고르개·더보기 메뉴와 달리 특성
 * 테스트를 새로 쓸 필요가 없었습니다 — 관문이 이미 서 있는 드문 경우입니다.
 *
 * ## 순서가 중요합니다
 *
 * 1. 여는 클릭에서 **선택 영역을 저장**하고 URL 을 미리 채웁니다 — 열린 뒤에는
 *    포커스가 다이얼로그로 넘어가 늦습니다.
 * 2. 적용은 **닫은 다음 프레임**에 합니다. 닫히기 전에 되돌리면 다이얼로그가
 *    아직 포커스를 쥐고 있어 선택이 다시 풀립니다.
 *
 * 둘 다 `useDialogHandle` 이 하던 것과 같고, `dialogSelection` 으로 옮겼습니다.
 */

export const LINK_DIALOG_TAG = 'sagak-link-dialog'

const ICON_SIZE = 18

define(LINK_DIALOG_TAG, (ctx) => {
  ctx.host.style.display = 'contents'

  const trigger = toolbarButton(
    { title: 'Insert Link' },
    icon(Link, ICON_SIZE)
  )

  const parts = dialog('Insert Link')
  const url = input({ type: 'text', placeholder: 'https://example.com' })
  const urlLabel = label('URL')
  Object.assign(urlLabel.style, {
    display: 'block',
    marginBottom: '4px',
    fontSize: '14px',
  })
  parts.body.append(urlLabel, url)

  const remove = button({ label: 'Remove' })
  const cancel = button({ label: 'Cancel' })
  const insert = button({ label: 'Insert' })
  parts.actions.append(remove, cancel, insert)

  ctx.host.append(trigger, parts.root)

  editorContextKey.consume(ctx, ($editor) => {
    ctx.effect($editor, (editor: EditorContext | null) => {
      if (!editor) return

      const selection = dialogSelection(editor, parts)

      /** 링크 위에 캐럿이 있으면 버튼이 켜집니다 */
      const sync = (): void => {
        if (getSelectedLink()) trigger.dataset.state = 'on'
        else delete trigger.dataset.state
      }
      sync()
      ctx.onCleanup(subscribeToSelection(editor, sync))

      ctx.on(trigger, 'click', () => {
        selection.save()
        url.value = getSelectedLink()?.href ?? ''
        parts.open()
      })

      const submit = (): void => {
        const trimmed = url.value.trim()
        /* URL 이 비어 있어도 닫기는 합니다 */
        if (!trimmed) {
          parts.close()
          return
        }
        selection.restoreThen(() => {
          editor.eventBus.emit(ContentEvents.LINK_CHANGED, { url: trimmed })
        })
      }

      ctx.on(insert, 'click', submit)
      ctx.on(url, 'keydown', (event) => {
        if (event.key === 'Enter') submit()
      })

      ctx.on(cancel, 'click', () => parts.close())

      ctx.on(remove, 'click', () => {
        selection.restoreThen(() => {
          /* 링크 전체를 선택 영역으로 잡아야 코어가 그 범위를 풀 수 있습니다 */
          const link = getSelectedLink()
          if (link) {
            const range = document.createRange()
            range.selectNodeContents(link)
            const sel = window.getSelection()
            sel?.removeAllRanges()
            sel?.addRange(range)
          }
          editor.eventBus.emit(ContentEvents.LINK_REMOVED)
        })
      })
    })
  })
})
