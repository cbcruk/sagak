import { define } from 'nanotags'
import { X } from 'lucide'
import { FontEvents } from 'sagak-core'
import type { EditorContext } from 'sagak-core'
import { editorContextKey } from './editor-context'
import { icon, toolbarButton } from './icon'
import {
  PRESET_COLORS,
  addRecentColor,
  loadRecentColors,
  type ColorType,
} from '../components/color-picker/color-picker.shared'

/**
 * 색 고르개 — 1단계에서 **팝오버**를 처음 만난 컴포넌트입니다.
 *
 * 앞의 것들은 컨트롤 하나였습니다. 여기는 열고 닫는 층이 하나 더 있고,
 * 바깥을 누르면 닫히는 문서 수준 리스너가 붙습니다.
 *
 * ## 옮기기 전에 테스트를 먼저 썼습니다
 *
 * 이 컴포넌트에는 검사가 **하나도 없었습니다.** 이주의 관문이 "테스트 개수가
 * 그대로인가" 인데 그러면 여기서는 관문이 눈이 멉니다. Preact 판에 대고
 * 특성 테스트 8개를 먼저 쓰고(`test/color-picker.browser.test.tsx`), 통과와
 * 대조군을 본 뒤에 옮겼습니다.
 *
 * ## `useEffect` 가 하던 일이 그대로 남습니다
 *
 * 바깥 클릭 리스너는 Preact 판에서 `useEffect` 로 붙였다 뗐습니다. 여기서는
 * `ctx.on(document, …)` 이 같은 일을 하고 **정리는 nanotags 가** 합니다 —
 * 엘리먼트가 떨어질 때 자동으로 뗍니다. 상태-구독과 달리 이건 **컴포넌트
 * 생애에 묶인 것이 맞아서**, 모듈로 올릴 이유가 없습니다.
 *
 * ## 최근 색상은 저장소가 원천입니다
 *
 * `useRecentColors` 의 `localStorage` 읽고 쓰기는 원래도 순수 함수였습니다.
 * 공유 파일로 빼서 양쪽이 같은 것을 씁니다 — 저장소 키는 사용자 데이터라
 * 이름이 갈리면 기존 색이 유실됩니다.
 */

export const COLOR_PICKER_TAG = 'sagak-color-picker'

const ICON_SIZE = 16
const SWATCH = 18

function swatchButton(color: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.title = color
  Object.assign(button.style, {
    width: `${SWATCH}px`,
    height: `${SWATCH}px`,
    background: color,
    border: '1px solid var(--sagak-chrome-border)',
    borderRadius: '2px',
    cursor: 'pointer',
  })
  return button
}

function grid(): HTMLDivElement {
  const el = document.createElement('div')
  Object.assign(el.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(10, 1fr)',
    gap: '2px',
  })
  return el
}

function caption(text: string, size: number, gap: number): HTMLDivElement {
  const el = document.createElement('div')
  el.textContent = text
  Object.assign(el.style, {
    marginBottom: `${gap}px`,
    fontSize: `${size}px`,
    color: 'var(--sagak-chrome-muted-fg)',
  })
  return el
}

define(COLOR_PICKER_TAG, (ctx) => {
  const type: ColorType =
    ctx.host.getAttribute('type') === 'background' ? 'background' : 'text'
  const isText = type === 'text'

  const container = document.createElement('div')
  container.style.position = 'relative'
  ctx.host.append(container)

  const swatch = document.createElement('div')
  Object.assign(swatch.style, {
    width: `${ICON_SIZE}px`,
    height: `${ICON_SIZE}px`,
    borderRadius: '2px',
  })

  const trigger = toolbarButton(
    { title: isText ? 'Text Color' : 'Highlight Color' },
    swatch
  )
  container.append(trigger)

  const popover = document.createElement('div')
  Object.assign(popover.style, {
    position: 'absolute',
    top: '100%',
    left: '0',
    marginTop: '4px',
    padding: '8px',
    background: 'var(--sagak-chrome-bg)',
    border: '1px solid var(--sagak-chrome-border)',
    borderRadius: '6px',
    boxShadow: '0 2px 8px var(--sagak-shadow)',
    zIndex: '1000',
    width: '220px',
  })

  let current = isText ? '#000000' : '#ffff00'
  let open = false

  function paintSwatch(): void {
    swatch.style.background = current
    swatch.style.border =
      isText && current !== '#ffffff'
        ? 'none'
        : '1px solid var(--sagak-chrome-border)'
  }

  /** 팝오버는 열 때마다 다시 세웁니다 — 최근 색상이 그 사이 바뀌었을 수 있습니다 */
  function build(onPick: (color: string) => void, onRemove: () => void): void {
    popover.replaceChildren()
    popover.append(caption(isText ? 'Text Color' : 'Highlight Color', 12, 8))

    const recent = loadRecentColors(type)
    if (recent.length > 0) {
      popover.append(caption('Recent', 11, 4))
      const recentGrid = grid()
      recentGrid.style.marginBottom = '8px'
      for (const color of recent) {
        const button = swatchButton(color)
        button.addEventListener('click', () => onPick(color))
        recentGrid.append(button)
      }
      popover.append(recentGrid)
    }

    const presets = grid()
    for (const color of PRESET_COLORS) {
      const button = swatchButton(color)
      button.addEventListener('click', () => onPick(color))
      presets.append(button)
    }
    popover.append(presets)

    if (!isText) {
      const remove = document.createElement('button')
      remove.type = 'button'
      Object.assign(remove.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: '100%',
        marginTop: '8px',
        padding: '6px 8px',
        border: '1px solid var(--sagak-chrome-border)',
        borderRadius: '4px',
        background: 'var(--sagak-chrome-bg)',
        color: 'var(--sagak-chrome-fg)',
        cursor: 'pointer',
        fontSize: '12px',
      })
      remove.append(icon(X, 12), document.createTextNode('Remove Highlight'))
      remove.addEventListener('click', onRemove)
      popover.append(remove)
    }
  }

  function close(): void {
    open = false
    popover.remove()
  }

  paintSwatch()

  editorContextKey.consume(ctx, ($editor) => {
    ctx.effect($editor, (editor: EditorContext | null) => {
      if (!editor) return

      const event = isText
        ? FontEvents.TEXT_COLOR_CHANGED
        : FontEvents.BACKGROUND_COLOR_CHANGED

      const pick = (color: string): void => {
        current = color
        paintSwatch()
        close()
        addRecentColor(type, color)
        editor.eventBus.emit(event, { color })
      }

      const remove = (): void => {
        close()
        editor.eventBus.emit(event, {
          color: isText ? '#000000' : 'transparent',
        })
        current = isText ? '#000000' : '#ffff00'
        paintSwatch()
      }

      ctx.on(trigger, 'click', () => {
        if (open) {
          close()
          return
        }
        build(pick, remove)
        container.append(popover)
        open = true
      })

      /*
       * 바깥을 누르면 닫습니다. Preact 판의 `useEffect` 와 같은 일인데, 여는
       * 동안만 붙였다 떼는 대신 늘 붙여 두고 열려 있을 때만 봅니다 — 리스너
       * 정리는 엘리먼트가 떨어질 때 nanotags 가 합니다.
       */
      ctx.on(document, 'mousedown', (domEvent) => {
        if (!open) return
        if (container.contains(domEvent.target as Node)) return
        close()
      })
    })
  })
})
