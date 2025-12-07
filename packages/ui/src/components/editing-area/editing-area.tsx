import { useRef } from 'preact/hooks'
import type { EditorMode } from '../mode-selector'
import { useEditingAreaContent } from './use-content'

/**
 * `EditingArea` 컴포넌트 속성
 */
export interface EditingAreaProps {
  /** 현재 편집 모드 */
  mode: EditorMode
  /** 초기 콘텐츠 (HTML) */
  initialContent?: string
  /** 콘텐츠 변경 시 호출될 콜백 */
  onChange?: (content: string) => void
  /** WYSIWYG 요소가 마운트될 때 호출될 콜백 */
  onWysiwygMount?: (element: HTMLElement) => void
}

/**
 * 편집 영역 컴포넌트
 *
 * @param props - `EditingArea` 속성
 * @returns 편집 영역 컴포넌트
 *
 * @example
 * ```tsx
 * <EditingArea
 *   mode={mode}
 *   initialContent="<p>Hello</p>"
 *   onWysiwygMount={element => editor.attachTo(element)}
 * />
 * ```
 */
export function EditingArea({
  mode,
  initialContent = '<p><br></p>',
  onChange,
  onWysiwygMount,
}: EditingAreaProps) {
  const wysiwygRef = useRef<HTMLDivElement>(null)
  const htmlRef = useRef<HTMLTextAreaElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const { content, handleWysiwygInput, handleHtmlInput, handleTextInput } =
    useEditingAreaContent({
      mode,
      initialContent,
      onChange,
      onWysiwygMount,
      refs: { wysiwyg: wysiwygRef, html: htmlRef, text: textRef },
    })

  return (
    <div data-scope="editing-area" data-part="root">
      {(() => {
        switch (mode) {
          case 'wysiwyg':
            return (
              <div
                ref={wysiwygRef}
                data-part="wysiwyg"
                contentEditable
                dangerouslySetInnerHTML={{ __html: content.wysiwyg }}
                onInput={handleWysiwygInput}
              />
            )
          case 'html':
            return (
              <textarea
                ref={htmlRef}
                data-part="html"
                value={content.html}
                onInput={handleHtmlInput}
                spellcheck={false}
              />
            )
          case 'text':
            return (
              <textarea
                ref={textRef}
                data-part="text"
                value={content.text}
                onInput={handleTextInput}
              />
            )
        }
      })()}
    </div>
  )
}
