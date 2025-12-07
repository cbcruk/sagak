# @sagak/ui

Preact와 Signals로 구축된 UI 컴포넌트입니다.

## 컴포넌트

### 툴바
- `Toolbar` - 모든 서식 버튼이 포함된 메인 툴바
- `ToolbarButton` - 개별 툴바 버튼

### 드롭다운
- `FontFamilyDropdown` - 글꼴 패밀리 선택기
- `FontSizeDropdown` - 글꼴 크기 선택기
- `HeadingDropdown` - 제목 수준 선택기

### 색상 선택기
- `TextColorPicker` - 텍스트 색상 선택
- `BackgroundColorPicker` - 배경 색상 선택

### 다이얼로그
- `LinkDialog` - 링크 삽입/편집
- `ImageDialog` - 이미지 삽입
- `TableDialog` - 표 생성
- `FindReplaceDialog` - 찾기 및 바꾸기

## 사용법

```tsx
import { render } from 'preact'
import { EditorProvider, Toolbar } from '@sagak/ui'
import { EditorCore } from '@sagak/core'

const editor = new EditorCore({
  element: document.getElementById('editor'),
})

await editor.run()

render(
  <EditorProvider context={editor.getContext()}>
    <Toolbar />
  </EditorProvider>,
  document.getElementById('toolbar-container')
)
```

## 훅

- `useEditorContext()` - 에디터 컨텍스트 접근
- `useEditorSignals()` - 시그널 형태의 서식 상태
- `useHistoryState()` - Undo/Redo 상태 및 액션

## 상태 관리

반응형 상태를 위해 Preact Signals 사용:

```tsx
import { useEditorSignals } from '@sagak/ui'

function BoldButton() {
  const { isBold, toggleBold } = useEditorSignals()

  return (
    <button
      class={isBold.value ? 'active' : ''}
      onClick={toggleBold}
    >
      굵게
    </button>
  )
}
```
