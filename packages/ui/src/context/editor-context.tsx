import type { ComponentChildren } from 'preact'
import { createContext } from 'preact'
import { useContext } from 'preact/hooks'
import type { EditorContext as CoreEditorContext } from 'sagak-core'

const EditorContext = createContext<CoreEditorContext | null>(null)

export interface EditorProviderProps {
  context: CoreEditorContext
  children: ComponentChildren
}

export function EditorProvider({
  context,
  children,
}: EditorProviderProps): ComponentChildren {
  return (
    <EditorContext.Provider value={context}>{children}</EditorContext.Provider>
  )
}

export function useEditorContext(): CoreEditorContext {
  const context = useContext(EditorContext)

  if (!context) {
    throw new Error(
      'useEditorContext must be used within EditorProvider. ' +
        'Make sure to wrap your components with <EditorProvider context={...}>.'
    )
  }

  return context
}
