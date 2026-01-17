# sagak-editor

React용 WYSIWYG 에디터 컴포넌트입니다.

## 설치

```bash
npm install sagak-editor sagak-core react react-dom
```

## 사용법

```tsx
import { useEditor, EditorProvider, Toolbar, EditorContainer } from 'sagak-editor'
import 'sagak-editor/styles.css'

function MyEditor() {
  const { containerRef, editor, ready } = useEditor({
    initialContent: '<p>Hello World</p>',
  })

  return (
    <EditorContainer>
      {ready && editor && (
        <EditorProvider context={editor.context}>
          <Toolbar />
        </EditorProvider>
      )}
      <div ref={containerRef} data-scope="editing-area" data-part="wysiwyg" />
    </EditorContainer>
  )
}
```

## useEditor 옵션

| 옵션 | 타입 | 설명 |
|------|------|------|
| `initialContent` | `string` | 초기 HTML 콘텐츠 |
| `spellCheck` | `boolean` | 브라우저 맞춤법 검사 |
| `autoSave.storageKey` | `string` | localStorage 저장 키 |
| `autoSave.debounceMs` | `number` | 자동 저장 딜레이 (ms) |
| `autoSave.restoreOnInit` | `boolean` | 초기화 시 저장된 콘텐츠 복원 |

## 컴포넌트

| 컴포넌트 | 설명 |
|----------|------|
| `EditorContainer` | 스타일이 적용된 래퍼 |
| `EditorProvider` | 에디터 컨텍스트 제공 |
| `Toolbar` | 전체 툴바 |
| `AutoSaveIndicator` | 자동 저장 상태 표시 |

### 개별 툴바 컴포넌트

```tsx
import {
  FontFamilySelect,
  FontSizeSelect,
  HeadingSelect,
  ColorPicker,
  AlignmentButtons,
  ListButtons,
  LinkDialog,
  ImageDialog,
  TableDialog,
  FindReplaceDialog,
  ExportMenu,
} from 'sagak-editor'
```

## 훅

| 훅 | 설명 |
|----|------|
| `useFormattingState` | 현재 텍스트 서식 상태 |
| `useHistoryState` | 실행 취소/다시 실행 상태 |
| `useFontState` | 현재 폰트 상태 |
| `useAutoSave` | 자동 저장 상태 |

## 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Cmd/Ctrl + B` | 굵게 |
| `Cmd/Ctrl + I` | 기울임 |
| `Cmd/Ctrl + U` | 밑줄 |
| `Cmd/Ctrl + Z` | 실행 취소 |
| `Cmd/Ctrl + Shift + Z` | 다시 실행 |
| `Cmd/Ctrl + K` | 링크 삽입 |

## 스타일 커스터마이징

```css
[data-scope='toolbar'] {
  --toolbar-bg: #f9fafb;
  --toolbar-border: #d1d5db;
}

[data-scope='editing-area'] {
  --editor-font-family: system-ui, sans-serif;
  --editor-font-size: 16px;
  --editor-line-height: 1.6;
}
```

## 라이선스

MIT
