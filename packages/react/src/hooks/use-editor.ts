import { useEffect, useRef, useState } from 'react'
import { createEditor, type CreateEditorOptions, type Editor } from 'sagak-core'

export type UseEditorOptions = Omit<CreateEditorOptions, 'container'>

export interface UseEditorReturn {
  containerRef: React.RefObject<HTMLDivElement>
  editor: Editor | null
  ready: boolean
  error: Error | null
}

export function useEditor(options: UseEditorOptions = {}): UseEditorReturn {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return

    const instance = createEditor({
      container: containerRef.current,
      ...options,
    })

    editorRef.current = instance

    instance
      .run()
      .then(() => {
        setReady(true)
      })
      .catch((err: Error) => {
        setError(err)
      })

    return () => {
      instance.destroy()
      editorRef.current = null
      setReady(false)
    }
  }, [])

  return {
    containerRef,
    editor: editorRef.current,
    ready,
    error,
  }
}
