import { Plugin as PMPlugin, NodeSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import type { Plugin, EditorContext } from '@/core'
import { runModelCommand } from '@/model/bridge'
import {
  updateImage,
  MAX_IMAGE_WIDTH,
  MAX_IMAGE_HEIGHT,
} from '@/model/commands'

/**
 * 이미지 크기 조절.
 *
 * ## 고친 것 둘
 *
 * **① 조절한 크기가 저장되지 않았습니다.** 예전 판은 `img.style.width` 를 DOM
 * 에 직접 썼습니다. 문서 모델을 안 지나므로 `getRawContent()` 에도 `toJSON()`
 * 에도 안 담겼습니다 — 새로 고치면 크기가 사라졌고 되돌리기도 안 됐습니다.
 * 그런데도 조절이 끝나면 `STYLE_CHANGED` 를 쏘아 저장을 예약했으니, **바뀐
 * 것이 안 담긴 내용을 저장하고 "Saved" 를 보여 줬습니다.**
 *
 * 스키마에는 `width`·`height` 가 원래 있습니다 — 다이얼로그는 그쪽으로 씁니다.
 * 조절만 안 쓰고 있었습니다. 이제 손을 뗄 때 `updateImage` 트랜잭션 하나로
 * 확정합니다.
 *
 * **② 편집 영역의 DOM 을 밖에서 뜯어고쳤습니다.** 손잡이를 붙이려고 `<span>`
 * 을 만들어 이미지를 그 안으로 **옮겼습니다.** `prosemirror-view` 가 관리하는
 * DOM 이라 다음 렌더에서 어긋날 수 있는 자리입니다. 지금은 손잡이가 편집
 * 영역 **밖에** 뜹니다 (`position: fixed`) — PM 의 DOM 은 안 건드립니다.
 *
 * ## 고른 이미지는 PM 이 압니다
 *
 * 이미지는 `selectable` 한 노드라 클릭하면 PM 이 `NodeSelection` 을 만들고
 * `ProseMirror-selectednode` 클래스를 붙입니다. 예전에는 그 선택을 이 플러그인
 * 이 따로 흉내 냈습니다 — `document.querySelector` 로 래퍼를 찾는 식이라
 * 에디터가 둘이면 남의 것을 잡을 수도 있었습니다.
 */
export interface ImageResizeOptions {
  /** @default 20 */
  minWidth?: number

  /** @default 20 */
  minHeight?: number

  /** @default 1920 — 모델의 상한과 같습니다 */
  maxWidth?: number

  /** @default 1080 — 모델의 상한과 같습니다 */
  maxHeight?: number

  /** @default 8 */
  handleSize?: number

  /** @default true */
  maintainAspectRatio?: boolean
}

type Corner = 'nw' | 'ne' | 'sw' | 'se'

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value))

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']

export function createImageResizePlugin(
  options: ImageResizeOptions = {}
): Plugin {
  const {
    minWidth = 20,
    minHeight = 20,
    maxWidth = MAX_IMAGE_WIDTH,
    maxHeight = MAX_IMAGE_HEIGHT,
    handleSize = 8,
    maintainAspectRatio = true,
  } = options

  const cleanupFns: Array<() => void> = []

  return {
    name: 'utility:image-resize',

    initialize(context: EditorContext) {
      const area = context.editingAreaManager?.getCurrentArea()

      if (!area?.addPlugin) return

      let view: EditorView | null = null
      let overlay: HTMLDivElement | null = null
      /** 지금 조절 중인 이미지 — 손잡이를 누른 순간부터 뗄 때까지 */
      let dragging: {
        img: HTMLImageElement
        corner: Corner
        startX: number
        startY: number
        startWidth: number
        startHeight: number
        ratio: number
        width: number
        height: number
      } | null = null

      const buildOverlay = (): HTMLDivElement => {
        const box = document.createElement('div')

        box.className = 'sagak-image-resize-overlay'
        box.style.cssText = [
          'position: fixed',
          'pointer-events: none',
          'border: 2px solid #007AFF',
          'box-sizing: border-box',
          'z-index: 10',
        ].join(';')

        for (const corner of CORNERS) {
          const handle = document.createElement('div')

          handle.className = `sagak-resize-handle sagak-resize-handle-${corner}`
          handle.dataset.handle = corner
          handle.style.cssText = [
            'position: absolute',
            `width: ${handleSize}px`,
            `height: ${handleSize}px`,
            'background: #007AFF',
            'border: 1px solid #fff',
            'border-radius: 2px',
            'pointer-events: auto',
            `cursor: ${corner}-resize`,
            corner[0] === 'n'
              ? `top: -${handleSize / 2}px`
              : `bottom: -${handleSize / 2}px`,
            corner[1] === 'w'
              ? `left: -${handleSize / 2}px`
              : `right: -${handleSize / 2}px`,
          ].join(';')

          box.appendChild(handle)
        }

        document.body.appendChild(box)

        return box
      }

      /** 지금 고른 이미지의 DOM — 없으면 `null` */
      const selectedImage = (): HTMLImageElement | null => {
        if (!view) return null

        const { selection } = view.state

        if (!(selection instanceof NodeSelection)) return null
        if (selection.node.type.name !== 'image') return null

        const dom = view.nodeDOM(selection.from)

        return dom instanceof HTMLImageElement ? dom : null
      }

      /**
       * 손잡이를 이미지 위에 맞춥니다.
       *
       * 문서가 바뀌거나 스크롤할 때마다 다시 맞춥니다 — 편집 영역 밖에 떠
       * 있으므로 같이 움직여 주지 않으면 어긋납니다.
       */
      const sync = (): void => {
        const img = dragging?.img ?? selectedImage()

        if (!img) {
          overlay?.remove()
          overlay = null

          return
        }

        overlay ??= buildOverlay()

        const rect = img.getBoundingClientRect()

        overlay.style.top = `${rect.top}px`
        overlay.style.left = `${rect.left}px`
        overlay.style.width = `${rect.width}px`
        overlay.style.height = `${rect.height}px`
      }

      const onMouseDown = (e: MouseEvent): void => {
        const target = e.target as HTMLElement
        const corner = target.dataset?.handle as Corner | undefined

        if (!corner || !target.classList.contains('sagak-resize-handle')) return

        const img = selectedImage()

        if (!img) return

        e.preventDefault()
        e.stopPropagation()

        dragging = {
          img,
          corner,
          startX: e.clientX,
          startY: e.clientY,
          startWidth: img.offsetWidth,
          startHeight: img.offsetHeight,
          ratio: img.offsetWidth / img.offsetHeight,
          width: img.offsetWidth,
          height: img.offsetHeight,
        }

        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
      }

      /**
       * 끄는 동안은 **미리보기**입니다 — 인라인 스타일로 그려만 둡니다.
       *
       * 트랜잭션을 매 프레임 던지면 되돌리기 기록이 끄는 횟수만큼 쌓입니다.
       * 확정은 손을 뗄 때 한 번입니다.
       */
      const onMouseMove = (e: MouseEvent): void => {
        if (!dragging) return

        const { corner, startX, startY, startWidth, startHeight, ratio } =
          dragging
        const dx = corner[1] === 'w' ? startX - e.clientX : e.clientX - startX
        const dy = corner[0] === 'n' ? startY - e.clientY : e.clientY - startY

        /* Shift 로 비율 고정을 뒤집습니다 */
        const keepRatio = maintainAspectRatio !== e.shiftKey

        /*
         * **상한 안에서 끕니다.**
         *
         * 모델이 상한을 넘는 값을 안 받으므로(`updateImage`), 여기서 안 막으면
         * 손을 뗄 때 트랜잭션이 조용히 거절됩니다 — 화면에는 커진 채로 보이다가
         * 다음 렌더에 되돌아가는 꼴입니다.
         */
        const width = clamp(startWidth + dx, minWidth, maxWidth)
        const height = clamp(
          keepRatio ? width / ratio : startHeight + dy,
          minHeight,
          maxHeight
        )

        dragging.width = Math.round(width)
        dragging.height = Math.round(height)

        dragging.img.style.width = `${dragging.width}px`
        dragging.img.style.height = `${dragging.height}px`

        sync()
      }

      const onMouseUp = (): void => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)

        if (!dragging) return

        const { width, height } = dragging

        dragging = null

        /* **여기가 문서에 남는 자리입니다.** */
        runModelCommand(
          context,
          updateImage({ width: `${width}px`, height: `${height}px` })
        )

        sync()
      }

      const onKeyDown = (e: KeyboardEvent): void => {
        if (e.key !== 'Escape' || !overlay) return

        overlay.remove()
        overlay = null
      }

      cleanupFns.push(
        area.addPlugin(
          new PMPlugin({
            view: (editorView) => {
              view = editorView
              sync()

              return {
                update: sync,
                destroy: () => {
                  view = null
                  overlay?.remove()
                  overlay = null
                },
              }
            },
          })
        )
      )

      document.addEventListener('mousedown', onMouseDown)
      document.addEventListener('keydown', onKeyDown)
      window.addEventListener('scroll', sync, true)
      window.addEventListener('resize', sync)

      cleanupFns.push(() => {
        document.removeEventListener('mousedown', onMouseDown)
        document.removeEventListener('keydown', onKeyDown)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        window.removeEventListener('scroll', sync, true)
        window.removeEventListener('resize', sync)
        overlay?.remove()
        overlay = null
      })
    },

    destroy() {
      cleanupFns.forEach((fn) => fn())
      cleanupFns.length = 0
    },
  }
}
