import {
  useEditor,
  EditorProvider,
  EditorContainer,
  Toolbar,
  AutocompletePopover,
  AutoSaveIndicator,
} from 'sagak-editor'

const INITIAL_CONTENT = `
<h1>사각사각</h1>
<p>글을 씁니다. 위 도구 모음으로 서식을 적용해보세요.</p>
<ul>
  <li>굵게 · 기울임 · 밑줄</li>
  <li>표, 이미지, 링크</li>
  <li>찾기/바꾸기</li>
</ul>
`

export function App(): React.ReactNode {
  const { containerRef, editor, ready, error } = useEditor({
    initialContent: INITIAL_CONTENT,
  })

  return (
    <main data-scope="app">
      <header data-part="header">
        <h1>sagak</h1>
      </header>

      {error && (
        <p role="alert" data-part="error">
          에디터를 시작하지 못했습니다: {error.message}
        </p>
      )}

      <EditorContainer>
        {/*
          컨텍스트를 쓰는 컴포넌트는 전부 EditorProvider 안에 있어야 합니다.
          편집 영역 div 는 useEditor 가 붙일 대상이므로 항상 렌더합니다.
        */}
        {ready && editor ? (
          <EditorProvider context={editor.context}>
            <Toolbar />
            <AutoSaveIndicator />
            <AutocompletePopover />
          </EditorProvider>
        ) : null}
        <div ref={containerRef} data-scope="editing-area" data-part="wysiwyg" />
      </EditorContainer>
    </main>
  )
}
