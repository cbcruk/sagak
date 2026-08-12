import type { JSX } from 'preact'
import {
  useEditor,
  EditorProvider,
  EditorContainer,
  Toolbar,
  AutocompletePopover,
} from 'sagak-ui'

const INITIAL_CONTENT = `
<h1>사각사각</h1>
<p>글을 씁니다. 위 도구 모음으로 서식을 적용해보세요.</p>
<ul>
  <li>굵게 · 기울임 · 밑줄</li>
  <li>표, 이미지, 링크</li>
  <li>찾기/바꾸기</li>
</ul>
`

export function App(): JSX.Element {
  /*
   * 자동 저장은 **앱에서 끕니다** (`createEditor` 기본값이 꺼짐이라 안 적습니다).
   *
   * 표시가 깜빡여서 툴바에서 내렸는데, 그러고 나니 남는 것이 **아무 신호 없이
   * localStorage 에 쓰고 다음 방문에 조용히 되살리는 동작**뿐이었습니다.
   * 저장되는지 알 수 없고, 되살아난 것인지도 알 수 없고, 초안을 지울 버튼도
   * 같이 사라진 상태입니다. 보이지 않는 채로 남의 글을 바꾸는 기능이라
   * 켜 둘 이유가 없습니다.
   *
   * 기능 자체는 `sagak-core` 에 그대로 있습니다 — `autoSave` 옵션과
   * `<Toolbar showAutoSaveIndicator />` 로 언제든 켤 수 있습니다.
   *
   * 다시 켤 조건: 상태가 조용해지고(깜빡이지 않고), 되살릴 때 **묻는** 길이
   * 생기면. 설계는 `docs/` 에서 이야기한 "복원을 물어보는" 쪽입니다.
   */
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
            <AutocompletePopover />
          </EditorProvider>
        ) : null}
        <div ref={containerRef} data-scope="editing-area" data-part="wysiwyg" />
      </EditorContainer>
    </main>
  )
}
