import type { Plugin, EditorContext } from '@/core'
import { runModelCommand } from '@/model/bridge'
import { insertImage } from '@/model/commands'

export interface ImageUploadPluginOptions {
  /**
   * Maximum file size in bytes
   * @default 5 * 1024 * 1024 (5MB)
   */
  maxFileSize?: number

  /**
   * Allowed image MIME types
   * @default ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
   */
  allowedTypes?: string[]

  /**
   * Custom upload handler. If provided, will be called instead of converting to base64.
   * Should return the URL of the uploaded image.
   */
  onUpload?: (file: File) => Promise<string>

  /**
   * Enable drag-and-drop image upload
   * @default true
   */
  enableDragDrop?: boolean

  /**
   * Enable paste image from clipboard
   * @default true
   */
  enablePaste?: boolean

  /**
   * Callback when upload starts
   */
  onUploadStart?: (file: File) => void

  /**
   * Callback when upload completes
   */
  onUploadComplete?: (url: string) => void

  /**
   * Callback when upload fails
   */
  onUploadError?: (error: Error) => void
}

// 이벤트 상수는 core/events.ts 에 모여 있습니다 (EditorEventMap 과 함께 관리)
import { ImageUploadEvents } from '@/core/events'

export { ImageUploadEvents }

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function isValidImageType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type)
}

export function createImageUploadPlugin(
  options: ImageUploadPluginOptions = {}
): Plugin {
  const {
    maxFileSize = 5 * 1024 * 1024,
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    onUpload,
    enableDragDrop = true,
    enablePaste = true,
    onUploadStart,
    onUploadComplete,
    onUploadError,
  } = options

  const cleanupFns: Array<() => void> = []

  async function processFile(
    file: File,
    eventBus: EditorContext['eventBus']
  ): Promise<string | null> {
    if (!isValidImageType(file, allowedTypes)) {
      const error = new Error(
        `Invalid file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}`
      )
      eventBus.emit(ImageUploadEvents.IMAGE_UPLOAD_ERROR, { error })
      onUploadError?.(error)
      return null
    }

    if (file.size > maxFileSize) {
      const error = new Error(
        `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(maxFileSize / 1024 / 1024).toFixed(2)}MB`
      )
      eventBus.emit(ImageUploadEvents.IMAGE_UPLOAD_ERROR, { error })
      onUploadError?.(error)
      return null
    }

    eventBus.emit(ImageUploadEvents.IMAGE_UPLOAD_START, { file })
    onUploadStart?.(file)

    try {
      let url: string

      if (onUpload) {
        url = await onUpload(file)
      } else {
        url = await fileToBase64(file)
      }

      eventBus.emit(ImageUploadEvents.IMAGE_UPLOAD_COMPLETE, { url })
      onUploadComplete?.(url)

      return url
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Upload failed')
      eventBus.emit(ImageUploadEvents.IMAGE_UPLOAD_ERROR, { error })
      onUploadError?.(error)
      return null
    }
  }

  async function insertImageFromFile(
    file: File,
    context: EditorContext
  ): Promise<void> {
    const url = await processFile(file, context.eventBus)

    if (url) {
      runModelCommand(context, insertImage({ src: url, alt: file.name }))
    }
  }

  return {
    name: 'utility:image-upload',

    initialize(context: EditorContext) {
      const { element, eventBus } = context
      if (!element) return

      const handleDragOver = (e: DragEvent): void => {
        if (!enableDragDrop) return
        e.preventDefault()
        e.stopPropagation()
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy'
        }
        element.dataset.dragOver = 'true'
      }

      const handleDragLeave = (e: DragEvent): void => {
        if (!enableDragDrop) return
        e.preventDefault()
        e.stopPropagation()
        delete element.dataset.dragOver
      }

      const handleDrop = async (e: DragEvent): Promise<void> => {
        if (!enableDragDrop) return
        e.preventDefault()
        e.stopPropagation()
        delete element.dataset.dragOver

        const files = e.dataTransfer?.files
        if (!files || files.length === 0) return

        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            await insertImageFromFile(file, context)
          }
        }
      }

      const handlePaste = async (e: ClipboardEvent): Promise<void> => {
        if (!enablePaste) return

        const items = e.clipboardData?.items
        if (!items) return

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            e.preventDefault()
            const file = item.getAsFile()
            if (file) {
              await insertImageFromFile(file, context)
            }
            break
          }
        }
      }

      const unsubUploadFromFile = eventBus.on(
        ImageUploadEvents.IMAGE_UPLOAD_FROM_FILE, (args?: unknown) => {
          const data = args as { file: File } | undefined
          if (data?.file) {
            void insertImageFromFile(data.file, context)
          }
        }
      )

      element.addEventListener('dragover', handleDragOver)
      element.addEventListener('dragleave', handleDragLeave)
      element.addEventListener('drop', handleDrop)
      element.addEventListener('paste', handlePaste)

      cleanupFns.push(() => {
        element.removeEventListener('dragover', handleDragOver)
        element.removeEventListener('dragleave', handleDragLeave)
        element.removeEventListener('drop', handleDrop)
        element.removeEventListener('paste', handlePaste)
        unsubUploadFromFile()
      })
    },

    destroy() {
      cleanupFns.forEach((fn) => fn())
      cleanupFns.length = 0
    },
  }
}
