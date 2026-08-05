import type { ComponentChildren, JSX } from 'preact'

export interface EditorContainerProps {
  children: ComponentChildren
  className?: string
  style?: JSX.CSSProperties
}

export function EditorContainer({
  children,
  className,
  style,
}: EditorContainerProps): ComponentChildren {
  return (
    <div
      data-scope="editor-container"
      data-part="root"
      className={className}
      style={style}
    >
      {children}
    </div>
  )
}
