# @sagak/editor

다중 모드 편집을 지원하는 뷰 독립적 에디터 로직입니다.

## 모듈

- **EditingAreaManager**: 다중 편집 모드 관리
- **WysiwygArea**: contentEditable을 사용한 WYSIWYG 편집
- **HtmlSourceArea**: HTML 소스 코드 편집
- **TextArea**: 일반 텍스트 편집
- **HtmlConverter**: 모드 간 콘텐츠 변환

## 편집 모드

| 모드 | 설명 |
|------|------|
| `wysiwyg` | 실시간 서식을 지원하는 리치 텍스트 편집 |
| `html` | 직접 HTML 소스 편집 |
| `text` | 일반 텍스트 편집 |

## 사용법

```typescript
import { EditorCore } from '@sagak/core'

const editor = new EditorCore({
  element: document.getElementById('editor'),
  editingAreaContainer: document.getElementById('editing-area'),
})

await editor.run()

// 모드 전환
const editingAreaManager = editor.getEditingAreaManager()
await editingAreaManager.switchMode('html')
await editingAreaManager.switchMode('wysiwyg')

// 콘텐츠 가져오기/설정하기
const content = await editingAreaManager.getContent()
await editingAreaManager.setContent('<p>Hello World</p>')
```

## 이벤트

- `EDITING_AREA_INITIALIZED` - 편집 영역 준비 완료
- `EDITING_AREA_MODE_CHANGING` - 모드 전환 전
- `EDITING_AREA_MODE_CHANGED` - 모드 전환 후
- `WYSIWYG_CONTENT_CHANGED` - 콘텐츠 수정됨
- `WYSIWYG_FOCUSED` / `WYSIWYG_BLURRED` - 포커스 이벤트
