# @sagak/core

sagak 에디터의 핵심 모듈입니다.

## 모듈

- **EventBus**: 3단계 이벤트 시스템 (BEFORE → ON → AFTER)
- **PluginManager**: 의존성 해결을 지원하는 플러그인 등록
- **SelectionManager**: CJK/IME 지원이 포함된 선택 영역 처리
- **EditorCore**: 모든 핵심 모듈을 통합한 파사드
- **HistoryManager**: 두 개의 스택 알고리즘을 사용한 Undo/Redo

## 사용법

### EventBus

```typescript
import { EventBus } from '@sagak/core'

const bus = new EventBus()

// 이벤트 구독
const unsubscribe = bus.on('BOLD_CLICKED', 'on', () => {
  document.execCommand('bold')
  bus.emit('SELECTION_CHANGED')
})

// 이벤트 발행
bus.emit('BOLD_CLICKED')

// 구독 해제
unsubscribe()
```

**이벤트 단계:**

1. **BEFORE**: 전처리 단계, `false` 반환 시 취소 가능
2. **ON**: 메인 처리 단계, `false` 반환 시 취소 가능
3. **AFTER**: 후처리 단계, 알림 전용

### PluginManager

```typescript
import { PluginManager, EventBus, Plugin } from '@sagak/core'

const context = {
  eventBus: new EventBus(),
  config: {},
}

const manager = new PluginManager(context)

// 플러그인 정의
const boldPlugin: Plugin = {
  name: 'text-style:bold',

  initialize(ctx) {
    ctx.eventBus.on('BOLD_CLICKED', 'on', () => {
      document.execCommand('bold')
    })
  },

  destroy() {
    // 리소스 정리
  },
}

// 플러그인 등록
await manager.register(boldPlugin)

// 의존성이 있는 플러그인
const toolbarPlugin: Plugin = {
  name: 'ui:toolbar',
  dependencies: ['text-style:bold'],

  initialize(ctx) {
    // 툴바 구현
  },
}

await manager.register(toolbarPlugin)
```

### SelectionManager

```typescript
import { SelectionManager } from '@sagak/core'

const editableElement = document.querySelector('[contenteditable]')
const manager = new SelectionManager(editableElement)

// 선택 영역 저장 (다이얼로그 열기 전에 유용)
manager.saveSelection()

// 다이얼로그 표시...
showLinkDialog(() => {
  // 선택 영역 복원
  manager.restoreSelection()

  // HTML 삽입
  manager.insertHTML('<a href="https://example.com">링크</a>')
})

// 일반 텍스트 삽입 (XSS 안전)
manager.insertText('Hello World')

// 선택된 콘텐츠 가져오기
const text = manager.getSelectedText()
const html = manager.getSelectedHTML()

// CJK/IME 입력 상태 확인
if (!manager.getIsComposing()) {
  // 선택 영역 조작 가능
}
```

**CJK/IME 지원:**

- 자동으로 입력 조합 이벤트 추적
- 한국어/일본어/중국어 입력 중 작업 방지
- 수동 IME 처리 불필요

### EditorCore

```typescript
import { EditorCore } from '@sagak/core'
import { createBoldPlugin } from '@sagak/plugins'

// EditorCore 인스턴스 생성
const core = new EditorCore({
  element: document.getElementById('editor'),
  plugins: [createBoldPlugin()],
})

// 애플리케이션 실행
await core.run()

// 메시지 실행
core.exec('BOLD_CLICKED')

// 브라우저 이벤트 등록
const button = document.getElementById('bold-btn')
core.registerBrowserEvent(button, 'click', 'BOLD_CLICKED')

// 지연 실행
core.delayedExec('AUTO_SAVE', 1000)

// 컴포넌트 접근
const eventBus = core.getEventBus()
const pluginManager = core.getPluginManager()
const selectionManager = core.getSelectionManager()
```
