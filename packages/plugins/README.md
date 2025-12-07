# @sagak/plugins

sagak 에디터의 기능 플러그인입니다.

## 사용 가능한 플러그인

### 텍스트 스타일
- `createBoldPlugin()` - 굵게 서식
- `createItalicPlugin()` - 기울임 서식
- `createUnderlinePlugin()` - 밑줄 서식
- `createStrikePlugin()` - 취소선 서식
- `createSubscriptPlugin()` - 아래 첨자 서식
- `createSuperscriptPlugin()` - 위 첨자 서식

### 글꼴
- `createFontFamilyPlugin()` - 글꼴 패밀리 선택
- `createFontSizePlugin()` - 글꼴 크기 선택
- `createTextColorPlugin()` - 텍스트 색상 선택
- `createBackgroundColorPlugin()` - 배경 색상 선택

### 단락
- `createHeadingPlugin()` - 제목 수준 (H1-H6)
- `createParagraphPlugin()` - 단락 서식
- `createAlignmentPlugin()` - 텍스트 정렬
- `createIndentPlugin()` - 들여쓰기 증가
- `createOutdentPlugin()` - 들여쓰기 감소
- `createOrderedListPlugin()` - 순서 있는 목록
- `createUnorderedListPlugin()` - 순서 없는 목록

### 콘텐츠
- `createLinkPlugin()` - 링크 삽입/편집
- `createImagePlugin()` - 이미지 삽입
- `createTablePlugin()` - 표 생성

### 유틸리티
- `createHistoryPlugin()` - Undo/Redo 기능
- `createFindReplacePlugin()` - 찾기 및 바꾸기

## 사용법

### 텍스트 스타일 플러그인

```typescript
import { EventBus, PluginManager } from '@sagak/core'
import { createBoldPlugin } from '@sagak/plugins'

const eventBus = new EventBus()
const context = { eventBus, selectionManager, config: {} }
const pluginManager = new PluginManager(context)

// Bold 플러그인 등록
const boldPlugin = createBoldPlugin({
  eventName: 'BOLD_CLICKED',
  checkComposition: true, // IME 입력 중 차단
})

await pluginManager.register(boldPlugin)

// 굵게 서식 적용
eventBus.emit('BOLD_CLICKED')
```

### 히스토리 플러그인

```typescript
import { EditorCore } from '@sagak/core'
import { createHistoryPlugin } from '@sagak/plugins'

const editor = new EditorCore({
  element: document.getElementById('editor'),
  plugins: [
    createHistoryPlugin({
      undoEventName: 'UNDO',
      redoEventName: 'REDO',
      maxHistorySize: 50,
      debounceDelay: 500,
    }),
  ],
})

await editor.run()

// 키보드 단축키 (자동)
// Ctrl+Z 또는 Cmd+Z → 실행 취소
// Ctrl+Y 또는 Cmd+Shift+Z → 다시 실행

// 프로그래밍 방식 제어
editor.exec('UNDO')
editor.exec('REDO')

// 상태 변경 감지
editor.getContext().eventBus.on('HISTORY_STATE_CHANGED', 'after', (data) => {
  console.log('실행 취소 가능:', data.canUndo)
  console.log('다시 실행 가능:', data.canRedo)
})
```

## 플러그인 특징

- 3단계 지원 이벤트 기반 (BEFORE/ON/AFTER)
- 자동 CJK/IME 입력 조합 차단
- 구성 가능한 이벤트 이름
- `destroy()`를 통한 깔끔한 생명주기 관리
