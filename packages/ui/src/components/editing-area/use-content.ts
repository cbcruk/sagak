import { useState } from 'preact/hooks'
import type {
  ModeContent,
  UseEditingAreaContentOptions,
  UseEditingAreaContentReturn,
} from './types'
import { htmlToText, textToHtml } from './utils'
import { useWysiwygMount } from './use-wysiwyg-mount'
import { useModeSwitching } from './use-mode-switching'

/**
 * 편집 영역의 콘텐츠 상태를 관리하는 훅
 *
 * 모드 전환 시 콘텐츠 동기화와 입력 핸들러를 제공합니다
 *
 * @param options - 훅 옵션
 * @returns 콘텐츠 상태와 핸들러
 *
 * @example
 * ```tsx
 * const { content, handleWysiwygInput, handleHtmlInput, handleTextInput } =
 *   useEditingAreaContent({
 *     mode,
 *     initialContent,
 *     onChange,
 *     refs: { wysiwyg: wysiwygRef, html: htmlRef, text: textRef },
 *   })
 * ```
 */
export function useEditingAreaContent({
  mode,
  initialContent,
  onChange,
  onWysiwygMount,
  refs,
}: UseEditingAreaContentOptions): UseEditingAreaContentReturn {
  const [content, setContent] = useState<ModeContent>({
    wysiwyg: initialContent,
    html: initialContent,
    text: htmlToText(initialContent),
  })

  useWysiwygMount({
    mode,
    wysiwygRef: refs.wysiwyg,
    onWysiwygMount,
  })

  useModeSwitching({
    mode,
    onChange,
    refs,
    setContent,
  })

  const handleWysiwygInput = () => {
    if (refs.wysiwyg.current) {
      const html = refs.wysiwyg.current.innerHTML
      setContent((prev) => ({
        ...prev,
        wysiwyg: html,
        html: html,
        text: htmlToText(html),
      }))
      onChange?.(html)
    }
  }

  const handleHtmlInput = (e: Event) => {
    const value = (e.target as HTMLTextAreaElement).value
    setContent((prev) => ({
      ...prev,
      wysiwyg: value,
      html: value,
      text: htmlToText(value),
    }))
    onChange?.(value)
  }

  const handleTextInput = (e: Event) => {
    const value = (e.target as HTMLTextAreaElement).value
    const html = textToHtml(value)
    setContent((prev) => ({
      ...prev,
      wysiwyg: html,
      html: html,
      text: value,
    }))
    onChange?.(html)
  }

  return {
    content,
    handleWysiwygInput,
    handleHtmlInput,
    handleTextInput,
  }
}
