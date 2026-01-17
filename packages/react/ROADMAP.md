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

- [x] Link
- [x] Image
- [x] Table

---

## Phase 3: 추가 Toolbar 기능

### 3.1 색상

- [x] Text Color Picker
- [x] Background Color Picker

### 3.2 정렬

- [x] Align Left / Center / Right / Justify 버튼

### 3.3 들여쓰기

- [x] Indent / Outdent 버튼

### 3.4 리스트

- [x] Ordered List 버튼
- [x] Unordered List 버튼

### 3.5 Table 고급 기능

- [x] 행 추가/삭제 버튼
- [x] 열 추가/삭제 버튼
- [x] 테이블 크기 조절

### 3.6 기타 텍스트 스타일

- [x] Subscript 버튼
- [x] Superscript 버튼

---

## Phase 4: 고급 기능

### 4.1 찾기/바꾸기

- [x] Find & Replace Dialog

### 4.2 키보드 단축키

- [x] 주요 명령어 키보드 단축키 지원

### 4.3 Toolbar 커스터마이징 (보류)

- [ ] 사용자 정의 Toolbar 구성 지원

---

## Phase 5: 디자인 구현 (TextEdit 참고)

> 레퍼런스: [Mac TextEdit 사용 설명서](MAC_TEXTEDIT_GUIDE.md)

### 5.1 Toolbar 디자인 개선

- [x] 아이콘 시스템 도입
  - [x] 아이콘 라이브러리 선택 (lucide-react)
  - [x] 텍스트 → 아이콘 버튼으로 교체
- [x] Toolbar 레이아웃 개선
  - [x] 버튼 그룹핑 및 구분선 정리
  - [x] 일관된 버튼 크기/간격
- [x] 상태 스타일링
  - [x] Hover 효과
  - [x] Active/Pressed 상태 (#007AFF)
  - [x] Disabled 상태
- [x] Tooltip 추가
  - [x] 버튼별 툴팁 (단축키 포함)

### 5.2 컴포넌트 스타일링

- [x] Dropdown 메뉴 스타일
  - [x] Font Family Select
  - [x] Font Size Select
  - [x] Heading Select
- [x] Dialog 스타일 통일
  - [x] Link Dialog
  - [x] Image Dialog
  - [x] Table Dialog
  - [x] Find/Replace Dialog
- [x] Color Picker 개선
  - [x] 프리셋 색상 팔레트
  - [x] 최근 사용 색상

### 5.3 편집 영역 스타일

- [x] 에디터 컨테이너 디자인 (EditorContainer 컴포넌트)
- [x] 편집 영역 기본 스타일
- [x] 콘텐츠 스타일 정규화 (p, ul, ol, h1-h6 margin)
- [x] 포커스 상태 표시
- [x] 스크롤바 스타일링

### 5.4 반응형 디자인

- [x] 모바일 대응 Toolbar
- [x] 터치 인터랙션 개선

---

## Phase 6: 누락 기능 추가

### 6.1 텍스트 서식

- [x] 줄 간격 (Line Height) 설정
- [x] 자간 (Letter Spacing) 설정

### 6.2 특수 기능

- [x] 특수 문자 삽입 Dialog
- [x] 가로줄 (Horizontal Rule) 삽입

### 6.3 고급 기능 (선택)

- [x] 맞춤법 검사 (브라우저 기본 활용)
- [x] 단어 자동완성

---

## Phase 7: 제품화 (후순위)

### 7.1 배포 준비

- [x] npm 패키지 빌드 설정
- [x] 패키지 문서화 (README, API 문서)
- [x] 버전 관리

### 7.2 데모/예제

- [x] 완성된 에디터 데모 페이지
- [x] 사용 예제 코드

### 7.3 품질 개선

- [x] 테스트 커버리지 확대 (Core: 93.63%, 856 tests)
- [x] 접근성(a11y) 개선

### 7.4 실사용 기능

- [x] 이미지 업로드/리사이즈
- [x] 자동 저장
- [x] 콘텐츠 내보내기 (HTML, Markdown 등)

---

## Phase 8: 블록 기반 에디터 (장기)

> contentEditable 대신 자체 렌더링 시스템으로 전환

### 8.1 블록 아키텍처

- [ ] 블록 데이터 모델 설계
- [ ] 블록 렌더러 구현
- [ ] 블록 간 간격/여백 시스템

### 8.2 블록 타입 구현

- [ ] Paragraph 블록
- [ ] Heading 블록
- [ ] List 블록 (ul, ol)
- [ ] Image 블록
- [ ] Table 블록

### 8.3 블록 인터랙션

- [ ] 블록 선택/포커스
- [ ] 블록 드래그 앤 드롭
- [ ] 블록 변환 (예: p → h1)

### 8.4 고급 기능

- [ ] 협업 편집 지원 (CRDT/OT)
- [ ] 블록 히스토리 관리

---

## 완료된 작업

- [x] packages/core + packages/react 구조 정리
- [x] useEditor 훅 구현
- [x] 기본 에디터 Storybook 동작 확인
