import { useRef, useEffect, type ReactNode } from 'preact/compat'
import type { EditingMode } from 'sagak-core'

export interface EditingAreaProps {
  mode?: EditingMode
  initialContent?: string
  onWysiwygMount?: (element: HTMLDivElement) => void
}

export function EditingArea({
  mode = 'wysiwyg',
  initialContent = '<p><br></p>',
  onWysiwygMount,
}: EditingAreaProps): ReactNode {
  const wysiwygRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode === 'wysiwyg' && wysiwygRef.current && onWysiwygMount) {
      onWysiwygMount(wysiwygRef.current)
    }
  }, [mode, onWysiwygMount])

  return (
    <div data-scope="editing-area" data-part="root">
      {mode === 'wysiwyg' && (
        <div
          ref={wysiwygRef}
          data-part="wysiwyg"
          contentEditable
          dangerouslySetInnerHTML={{ __html: initialContent }}
        />
      )}
      {mode === 'html' && (
        <textarea
          data-part="html"
          defaultValue={initialContent}
          spellcheck={false}
        />
      )}
      {mode === 'text' && <textarea data-part="text" defaultValue="" />}
    </div>
  )
}
