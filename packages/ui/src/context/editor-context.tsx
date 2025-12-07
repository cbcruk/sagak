import { createContext } from 'preact'
import { useContext } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import type { EditorContext as CoreEditorContext } from '@sagak/core'

/** Preact용 Editor Context */
const EditorContext = createContext<CoreEditorContext | null>(null)

/**
 * `EditorProvider` 컴포넌트의 속성
 */
export interface EditorProviderProps {
  /** `@sagak/core`의 `EditorContext` */
  context: CoreEditorContext
  /** 자식 컴포넌트들 */
  children: ComponentChildren
}

/**
 * `EditorContext`를 제공하는 Provider 컴포넌트
 *
 * 모든 UI 컴포넌트를 이 Provider로 감싸야 합니다
 *
 * @param props - `EditorProvider` 속성
 * @returns Provider 컴포넌트
 *
 * @example
 * ```tsx
 * import { EditorProvider } from '@sagak/ui';
 *
 * const editor = new EditorCore({...});
 * await editor.run();
 *
 * render(
 *   <EditorProvider context={editor.getContext()}>
 *     <Toolbar />
 *     <Dialog />
 *   </EditorProvider>,
 *   container
 * );
 * ```
 */
export function EditorProvider({ context, children }: EditorProviderProps) {
  return (
    <EditorContext.Provider value={context}>{children}</EditorContext.Provider>
  )
}

/**
 * `EditorContext`를 사용하는 hook
 *
 * `EditorProvider` 내부에서만 사용할 수 있습니다
 *
 * @returns `EditorContext`
 * @throws `EditorProvider` 외부에서 사용 시 에러 발생
 *
 * @example
 * ```tsx
 * function Toolbar() {
 *   const editorContext = useEditorContext();
 *
 *   const handleBold = () => {
 *     editorContext.eventBus.emit('TOGGLE_BOLD');
 *   };
 *
 *   return <button onClick={handleBold}>Bold</button>;
 * }
 * ```
 */
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
