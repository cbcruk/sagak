import type { Plugin, EditorContext } from '@/core'
import { CoreEvents } from '@/core'

export interface ImageResizePluginOptions {
  /**
   * Minimum image width in pixels
   * @default 20
   */
  minWidth?: number

  /**
   * Minimum image height in pixels
   * @default 20
   */
  minHeight?: number

  /**
   * Size of resize handles in pixels
   * @default 8
   */
  handleSize?: number

  /**
   * Whether to maintain aspect ratio by default
   * @default true
   */
  maintainAspectRatio?: boolean
}

export const ImageResizeEvents = {
  IMAGE_RESIZE_START: 'IMAGE_RESIZE_START',
  IMAGE_RESIZE_END: 'IMAGE_RESIZE_END',
} as const

export function createImageResizePlugin(
  options: ImageResizePluginOptions = {}
): Plugin {
  const {
    minWidth = 20,
    minHeight = 20,
    handleSize = 8,
    maintainAspectRatio = true,
  } = options

  let selectedImage: HTMLImageElement | null = null
  let resizeOverlay: HTMLDivElement | null = null
  let isResizing = false
  let startX = 0
  let startY = 0
  let startWidth = 0
  let startHeight = 0
  let aspectRatio = 1
  let currentHandle: string | null = null

  const cleanupFns: Array<() => void> = []

  function createResizeOverlay(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'sagak-image-resize-overlay'
    overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px solid #007AFF;
      box-sizing: border-box;
    `

    const handles = ['nw', 'ne', 'sw', 'se']
    handles.forEach((position) => {
      const handle = document.createElement('div')
      handle.className = `sagak-resize-handle sagak-resize-handle-${position}`
      handle.dataset.handle = position
      handle.style.cssText = `
        position: absolute;
        width: ${handleSize}px;
        height: ${handleSize}px;
        background: #007AFF;
        border: 1px solid #fff;
        border-radius: 2px;
        pointer-events: auto;
        cursor: ${position}-resize;
      `

      switch (position) {
        case 'nw':
          handle.style.top = `-${handleSize / 2}px`
          handle.style.left = `-${handleSize / 2}px`
          break
        case 'ne':
          handle.style.top = `-${handleSize / 2}px`
          handle.style.right = `-${handleSize / 2}px`
          break
        case 'sw':
          handle.style.bottom = `-${handleSize / 2}px`
          handle.style.left = `-${handleSize / 2}px`
          break
        case 'se':
          handle.style.bottom = `-${handleSize / 2}px`
          handle.style.right = `-${handleSize / 2}px`
          break
      }

      overlay.appendChild(handle)
    })

    return overlay
  }

  function positionOverlay(img: HTMLImageElement, overlay: HTMLDivElement): void {
    const rect = img.getBoundingClientRect()
    const containerRect = img.offsetParent?.getBoundingClientRect() || {
      left: 0,
      top: 0,
    }

    overlay.style.left = `${rect.left - containerRect.left}px`
    overlay.style.top = `${rect.top - containerRect.top}px`
    overlay.style.width = `${rect.width}px`
    overlay.style.height = `${rect.height}px`
  }

  function showResizeHandles(img: HTMLImageElement, container: HTMLElement): void {
    hideResizeHandles()

    selectedImage = img
    resizeOverlay = createResizeOverlay()

    const wrapper = document.createElement('div')
    wrapper.className = 'sagak-image-resize-wrapper'
    wrapper.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    `
    wrapper.appendChild(resizeOverlay)
    container.style.position = 'relative'
    container.appendChild(wrapper)

    positionOverlay(img, resizeOverlay)
  }

  function hideResizeHandles(): void {
    const wrapper = document.querySelector('.sagak-image-resize-wrapper')
    if (wrapper) {
      wrapper.remove()
    }
    selectedImage = null
    resizeOverlay = null
  }

  function handleMouseDown(e: MouseEvent): void {
    const target = e.target as HTMLElement
    if (!target.classList.contains('sagak-resize-handle')) return

    e.preventDefault()
    e.stopPropagation()

    if (!selectedImage) return

    isResizing = true
    currentHandle = target.dataset.handle || null
    startX = e.clientX
    startY = e.clientY
    startWidth = selectedImage.offsetWidth
    startHeight = selectedImage.offsetHeight
    aspectRatio = startWidth / startHeight

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  function handleMouseMove(e: MouseEvent): void {
    if (!isResizing || !selectedImage || !resizeOverlay) return

    const deltaX = e.clientX - startX
    const deltaY = e.clientY - startY

    let newWidth = startWidth
    let newHeight = startHeight

    const shiftPressed = e.shiftKey
    const shouldMaintainRatio = maintainAspectRatio !== shiftPressed

    switch (currentHandle) {
      case 'se':
        newWidth = startWidth + deltaX
        newHeight = shouldMaintainRatio
          ? newWidth / aspectRatio
          : startHeight + deltaY
        break
      case 'sw':
        newWidth = startWidth - deltaX
        newHeight = shouldMaintainRatio
          ? newWidth / aspectRatio
          : startHeight + deltaY
        break
      case 'ne':
        newWidth = startWidth + deltaX
        newHeight = shouldMaintainRatio
          ? newWidth / aspectRatio
          : startHeight - deltaY
        break
      case 'nw':
        newWidth = startWidth - deltaX
        newHeight = shouldMaintainRatio
          ? newWidth / aspectRatio
          : startHeight - deltaY
        break
    }

    newWidth = Math.max(minWidth, newWidth)
    newHeight = Math.max(minHeight, newHeight)

    selectedImage.style.width = `${newWidth}px`
    selectedImage.style.height = `${newHeight}px`

    positionOverlay(selectedImage, resizeOverlay)
  }

  function handleMouseUp(): void {
    if (isResizing && selectedImage) {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      isResizing = false
      currentHandle = null
    }
  }

  return {
    name: 'utility:image-resize',

    initialize(context: EditorContext) {
      const { element, eventBus } = context
      if (!element) return

      const handleClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement

        if (target.tagName === 'IMG') {
          eventBus.emit(CoreEvents.CAPTURE_SNAPSHOT)
          showResizeHandles(target as HTMLImageElement, element)
          eventBus.emit(ImageResizeEvents.IMAGE_RESIZE_START, { image: target })
        } else if (
          !target.classList.contains('sagak-resize-handle') &&
          selectedImage
        ) {
          hideResizeHandles()
          eventBus.emit(ImageResizeEvents.IMAGE_RESIZE_END)
          eventBus.emit(CoreEvents.STYLE_CHANGED, {
            style: 'image',
            action: 'resize',
          })
        }
      }

      const handleKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'Escape' && selectedImage) {
          hideResizeHandles()
        }
      }

      element.addEventListener('click', handleClick)
      document.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('keydown', handleKeyDown)

      cleanupFns.push(() => {
        element.removeEventListener('click', handleClick)
        document.removeEventListener('mousedown', handleMouseDown)
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        hideResizeHandles()
      })
    },

    destroy() {
      cleanupFns.forEach((fn) => fn())
      cleanupFns.length = 0
    },
  }
}
