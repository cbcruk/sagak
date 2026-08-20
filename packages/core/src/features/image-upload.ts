import type { Plugin, EditorContext } from '@/core'
import { runModelCommand } from '@/model/bridge'
import { insertImage } from '@/model/commands'

/**
 * 이미지 업로드 — **모듈 API 입니다.**
 *
 * ## 왜 이벤트가 아니어야 했나
 *
 * 넷이 있었고 넷 다 죽어 있었습니다.
 *
 * `IMAGE_UPLOAD_START`·`COMPLETE`·`ERROR` 는 **아무도 안 들었습니다.** 게다가
 * 같은 것을 알리는 `onUploadStart`·`onUploadComplete`·`onUploadError` 콜백이
 * 이미 옵션에 있었습니다 — 확장점이 두 벌이었고 한 벌은 쓰인 적이 없습니다.
 *
 * `IMAGE_UPLOAD_FROM_FILE` 은 **아무도 안 불렀습니다.** 그런데 그 뒤에 달린
 * 코드(형식 검사·크기 검사·base64 변환)는 멀쩡했고, **UI 가 그것을 똑같이 다시
 * 짜서 쓰고 있었습니다.** 이미지 다이얼로그의 파일 갈래가 그것입니다. 허용
 * 형식과 크기 상한도 양쪽에 따로 적혀 있었습니다.
 *
 * 문을 열어 둔 채 아무도 못 찾게 두면 옆에 문을 하나 더 뚫습니다.
 *
 * ## 읽기와 넣기를 나눕니다
 *
 * 편집 영역에 끌어다 놓거나 붙여넣으면 **바로 넣는 것**이 맞습니다(`insert`).
 * 다이얼로그는 넣기 전에 **미리 보여 줘야** 하므로 읽기만 필요합니다(`read`).
 * 검사와 변환은 한 벌이고, 그것을 어디에 쓸지만 다릅니다.
 */

/** 받는 형식 — 사용자에게 보이는 문구(`max 5MB`)와 짝입니다 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024

export interface ImageUploadOptions {
  /** @default 5MB */
  maxFileSize?: number

  /** @default ALLOWED_IMAGE_TYPES */
  allowedTypes?: string[]

  /**
   * 직접 올리고 URL 을 돌려줍니다. 없으면 base64 로 담습니다.
   */
  onUpload?: (file: File) => Promise<string>

  /** @default true */
  enableDragDrop?: boolean

  /** @default true */
  enablePaste?: boolean

  onUploadStart?: (file: File) => void
  onUploadComplete?: (url: string) => void
  onUploadError?: (error: Error) => void
}

/**
 * 읽은 결과.
 *
 * 던지지 않고 돌려줍니다 — 형식이 안 맞거나 큰 것은 **예외가 아니라 답**이고,
 * 부르는 쪽은 그 문구를 그대로 화면에 씁니다.
 */
export type ImageReadResult =
  | { ok: true; url: string; name: string }
  | { ok: false; message: string }

export interface ImageUpload {
  /** 파일을 넣을 수 있는 URL 로. **문서는 안 건드립니다** */
  read(file: File): Promise<ImageReadResult>
  /** 읽어서 캐럿 자리에 넣습니다 */
  insert(file: File): Promise<boolean>
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * 옵션의 주인은 플러그인이지만 모듈도 같은 것을 봐야 합니다.
 *
 * 플러그인이 안 붙어 있어도(`replaceDefaultPlugins`) `read` 는 기본값으로
 * 돌아야 합니다 — 다이얼로그는 플러그인과 상관없이 뜹니다.
 */
const options = new WeakMap<EditorContext, ImageUploadOptions>()

const modules = new WeakMap<EditorContext, ImageUpload>()

export function imageUpload(context: EditorContext): ImageUpload {
  const existing = modules.get(context)

  if (existing) return existing

  const module: ImageUpload = {
    async read(file) {
      const {
        maxFileSize = MAX_IMAGE_SIZE,
        allowedTypes = ALLOWED_IMAGE_TYPES,
        onUpload,
        onUploadStart,
        onUploadComplete,
        onUploadError,
      } = options.get(context) ?? {}

      const fail = (message: string): ImageReadResult => {
        onUploadError?.(new Error(message))

        return { ok: false, message }
      }

      if (!allowedTypes.includes(file.type)) {
        return fail(
          'Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.'
        )
      }

      if (file.size > maxFileSize) {
        return fail(
          `File size exceeds ${maxFileSize / 1024 / 1024}MB limit.`
        )
      }

      onUploadStart?.(file)

      try {
        const url = onUpload ? await onUpload(file) : await fileToBase64(file)

        onUploadComplete?.(url)

        return { ok: true, url, name: file.name }
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Upload failed')
      }
    },

    async insert(file) {
      const result = await module.read(file)

      if (!result.ok) return false

      return runModelCommand(
        context,
        insertImage({ src: result.url, alt: result.name })
      )
    },
  }

  modules.set(context, module)

  return module
}

/**
 * 끌어다 놓기와 붙여넣기.
 *
 * 이쪽은 편집 영역에 달라붙는 **일꾼**이라 플러그인 자리가 맞습니다.
 */
export function createImageUploadPlugin(
  settings: ImageUploadOptions = {}
): Plugin {
  const { enableDragDrop = true, enablePaste = true } = settings

  const cleanupFns: Array<() => void> = []

  return {
    name: 'utility:image-upload',

    initialize(context: EditorContext) {
      const { element } = context

      if (!element) return

      options.set(context, settings)

      const module = imageUpload(context)

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
            await module.insert(file)
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
              await module.insert(file)
            }

            break
          }
        }
      }

      element.addEventListener('dragover', handleDragOver)
      element.addEventListener('dragleave', handleDragLeave)
      element.addEventListener('drop', handleDrop)
      element.addEventListener('paste', handlePaste)

      cleanupFns.push(() => {
        element.removeEventListener('dragover', handleDragOver)
        element.removeEventListener('dragleave', handleDragLeave)
        element.removeEventListener('drop', handleDrop)
        element.removeEventListener('paste', handlePaste)
      })
    },

    destroy() {
      cleanupFns.forEach((fn) => fn())
      cleanupFns.length = 0
    },
  }
}
