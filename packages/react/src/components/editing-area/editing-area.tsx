import { useRef, useEffect, type ReactNode } from 'react'
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
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: initialContent }}
        />
      )}
      {mode === 'html' && (
        <textarea
          data-part="html"
          defaultValue={initialContent}
          spellCheck={false}
        />
      )}
      {mode === 'text' && <textarea data-part="text" defaultValue="" />}
    </div>
  )
}
