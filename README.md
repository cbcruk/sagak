# sagak

> 사각사각, 글을 씁니다

TypeScript와 최신 웹 기술로 만든 WYSIWYG 에디터입니다.

## 목표

- **타입 안전성**: TypeScript로 개발자 경험 향상
- **뷰 독립적**: UI 프레임워크에 독립적인 코어 로직
- **이벤트 기반**: EventBus를 활용한 플러그인 아키텍처

## 구조

```
packages/
├── core/          # EventBus, PluginManager, SelectionManager
├── editor/        # 뷰 독립적 에디터 로직
├── plugins/       # 기능 플러그인
└── ui/            # UI 레이어 (Preact + Signals)
```

## 시작하기

```bash
pnpm install   # 의존성 설치
pnpm dev       # 개발 서버
pnpm test      # 테스트 실행
pnpm build     # 프로덕션 빌드
```

## 패키지

각 패키지별 README에서 사용 예제를 확인할 수 있습니다:

- [@sagak/core](packages/core/README.md) - EventBus, PluginManager, SelectionManager, EditorCore
- [@sagak/plugins](packages/plugins/README.md) - 텍스트 스타일, 폰트, 문단, 콘텐츠 플러그인
- [@sagak/editor](packages/editor/README.md) - 멀티모드 편집 (WYSIWYG, HTML, Text)
- [@sagak/ui](packages/ui/README.md) - Preact 컴포넌트와 훅

## 문서

- [개발 진행 상황](docs/PROGRESS.md) - 상태, 테스트 커버리지, 로드맵
- [테스트 가이드](docs/TESTING_GUIDE.md) - Why/How 학습 전략, 테스트 패턴
- [CJK 지원](docs/CJK_SUPPORT.md) - 한국어/일본어/중국어 입력 처리

## 라이선스

MIT
