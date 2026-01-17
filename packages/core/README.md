# sagak-core

WYSIWYG 에디터의 코어 라이브러리입니다.

## 설치

```bash
npm install sagak-core
```

## 사용법

```typescript
import { createEditor } from 'sagak-core'

const editor = createEditor({
  plugins: ['bold', 'italic', 'underline', 'heading', 'link', 'table'],
})

editor.mount(document.getElementById('editor'))

// 콘텐츠 제어
editor.setContent('<p>Hello World</p>')
const html = editor.getContent()

// 이벤트 구독
editor.on('content:change', ({ html }) => {
  console.log('Content changed:', html)
})

// 명령 실행
editor.execute('bold')
editor.execute('heading', { level: 2 })
```

## 플러그인

### 텍스트 스타일
- `bold`, `italic`, `underline`, `strike`, `subscript`, `superscript`

### 폰트
- `fontFamily`, `fontSize`, `textColor`, `backgroundColor`

### 문단
- `heading`, `paragraph`, `alignment`
- `orderedList`, `unorderedList`, `indent`, `outdent`

### 콘텐츠
- `link`, `table`, `image`
- `imageResize`, `imageUpload`, `tableResize`

### 유틸리티
- `history` - 실행 취소/다시 실행
- `findReplace` - 찾기/바꾸기
- `autoSave` - 자동 저장
- `autocomplete` - 자동 완성
- `export` - HTML/Markdown/텍스트 내보내기

## 커스텀 플러그인

```typescript
import { definePlugin } from 'sagak-core'

const myPlugin = definePlugin({
  name: 'myPlugin',
  init(context) {
    context.eventBus.on('MY_EVENT', (data) => {
      // handle event
    })
  },
  handlers: {
    myCommand: (context, payload) => {
      // execute command
    },
  },
})
```

## 라이선스

MIT
