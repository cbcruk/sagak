# packages/react Roadmap

## 원칙

- 각 단계마다 Storybook에서 동작 확인
- 동작 확인 후 다음 단계 진행
- 기존 라이브러리 활용 (Radix UI)

---

## Phase 1: Toolbar 기초

### 1.1 Base UI 설치 및 기본 테스트

- [x] `@base-ui/react` 설치
- [x] Storybook에서 Toggle 렌더링 확인

### 1.2 Bold 버튼 추가

- [x] Bold 버튼 하나만 추가
- [x] 클릭 시 선택 텍스트에 Bold 적용 확인

### 1.3 useFormattingState 연동

- [x] Bold 상태일 때 버튼 활성화(pressed) 표시
- [x] 커서 이동 시 상태 업데이트 확인

### 1.4 텍스트 스타일 버튼 확장

- [x] Italic 버튼 추가 및 동작 확인
- [x] Underline 버튼 추가 및 동작 확인
- [x] Strike 버튼 추가 및 동작 확인

### 1.5 Toolbar 컴포넌트 추출

- [x] 버튼들을 Toolbar 컴포넌트로 묶기
- [x] packages/react에서 export

---

## Phase 2: 추가 기능 (예정)

### 2.1 History (Undo/Redo)

- [x] useHistoryState 연동
- [x] Undo/Redo 버튼 추가

### 2.2 Dropdown 기반 컴포넌트

- [x] Font Family
- [x] Font Size
- [x] Heading

### 2.3 Dialog 기반 컴포넌트

- [ ] Link
- [ ] Image
- [ ] Table

---

## 완료된 작업

- [x] packages/core + packages/react 구조 정리
- [x] useEditor 훅 구현
- [x] 기본 에디터 Storybook 동작 확인
