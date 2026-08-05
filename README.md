# sagak

> 사각사각, 글을 씁니다

TypeScript와 Preact로 만든 WYSIWYG 에디터입니다.

## 특징

- **타입 안전성**: TypeScript로 개발자 경험 향상
- **플러그인 아키텍처**: 필요한 기능만 선택적으로 사용
- **가벼운 뷰**: Preact 기반 컴포넌트
- **풍부한 기능**: 텍스트 스타일, 테이블, 이미지, 찾기/바꾸기 등

## 실행

```bash
pnpm install
pnpm dev        # 에디터 앱 실행
```

> 이 저장소는 **앱**입니다. npm 배포는 하지 않습니다 —
> 배경은 [`docs/app-or-library.md`](docs/app-or-library.md) 참고.

## 사용법

```tsx
import { Editor, Toolbar, EditorArea, useEditor } from 'sagak-ui'
import 'sagak-ui/styles.css'

function App() {
  const editor = useEditor()

  return (
    <Editor editor={editor}>
      <Toolbar />
      <EditorArea />
    </Editor>
  )
}
```

## 패키지

```
packages/
├── core/    # sagak-core: 에디터 코어 및 플러그인
└── react/   # sagak-ui: Preact 컴포넌트
```

### sagak-core

프레임워크 독립적인 에디터 코어 로직:

- `createEditor()` - 에디터 인스턴스 생성
- `EventBus` - 이벤트 기반 통신
- `PluginManager` - 플러그인 관리
- 20+ 내장 플러그인 (Bold, Italic, Table, Image 등)

### sagak-ui

Preact 컴포넌트와 훅:

- `<Editor>`, `<Toolbar>`, `<EditorArea>` - UI 컴포넌트
- `useEditor()` - 에디터 인스턴스 훅
- 다이얼로그, 드롭다운, 컬러피커 등 UI 요소

## 개발

```bash
pnpm install      # 의존성 설치
pnpm dev          # 개발 서버
pnpm test         # 테스트 실행
pnpm build        # 프로덕션 빌드
```

## 데모

[https://cbcruk.github.io/sagak/](https://cbcruk.github.io/sagak/) 에서 에디터를 체험해보세요.

## 라이선스

MIT
