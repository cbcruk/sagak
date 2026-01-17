import type { ReactNode, CSSProperties } from 'react'

export interface EditorContainerProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function EditorContainer({
  children,
  className,
  style,
}: EditorContainerProps): ReactNode {
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
