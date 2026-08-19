/**
 * 편집 영역 타입
 * 편집 영역 모듈의 타입 정의
 */

import type { Node } from 'prosemirror-model'
import type { Plugin as PMPlugin } from 'prosemirror-state'
import type { StateHandle } from '@/model/register'
import type { ModelListener } from '@/model/bridge'
import type { Highlighter } from '@/core/types'

/**
 * 에디터가 지원하는 편집 모드
 */
export type EditingMode = 'wysiwyg' | 'html' | 'text'

/**
 * 모드 사이를 오가는 **공통 형식**입니다.
 *
 * 예전에는 HTML 문자열이었습니다. 그러면 모드를 바꿀 때마다 문자열을 다시
 * 파싱해야 하고, 무엇보다 **무엇이 진실인지가 모호해집니다** — WYSIWYG 의
 * `innerHTML` 과 소스 모드의 textarea 값이 각자 진실 행세를 합니다.
 *
 * 이제 진실은 **문서 모델 하나**이고 각 모드는 그것을 보여 주는 창입니다.
 * HTML 은 밖으로 나갈 때(내보내기·소스 보기·붙여넣기) 쓰는 형식이지 저장
 * 형식이 아닙니다 (`docs/prosemirror-migration.md` §8).
 */
export type IRContent = Node

/**
 * `EditingArea` 설정
 */
export interface EditingAreaConfig {
  /**
   * 편집 영역의 컨테이너 요소
   */
  container: HTMLElement

  /**
   * 최소 높이 (픽셀)
   */
  minHeight?: number

  /**
   * 자동 크기 조정 활성화
   */
  autoResize?: boolean

  /**
   * 편집 영역의 CSS 클래스 이름
   */
  className?: string

  /**
   * 맞춤법 검사 활성화 (기본값: true)
   */
  spellCheck?: boolean

}

/**
 * 모든 편집 영역의 기본 인터페이스
 * 각 모드(WYSIWYG, HTML, Text)는 이 인터페이스를 구현해야 함
 */
export interface EditingArea {
  /**
   * 지금 이 모드가 보고 있는 문서를 **모델로** 돌려줍니다
   */
  getContent(): Promise<IRContent>

  /**
   * 모델을 이 모드가 보여 줄 꼴로 옮깁니다
   */
  setContent(content: IRContent): Promise<void>

  /**
   * 이 편집 영역을 표시합니다
   *
   * @returns 영역 표시 완료 시 resolve되는 `Promise`
   */
  show(): Promise<void>

  /**
   * 이 편집 영역을 숨깁니다
   *
   * @returns 영역 숨김 완료 시 resolve되는 `Promise`
   */
  hide(): Promise<void>

  /**
   * 편집 영역에 포커스를 설정합니다
   */
  focus(): void

  /**
   * 편집 가능 여부를 설정합니다
   *
   * @param enabled - 편집 활성화 여부
   */
  setEditable(enabled: boolean): void

  /**
   * 맞춤법 검사 활성화 여부를 설정합니다
   *
   * @param enabled - 맞춤법 검사 활성화 여부
   */
  setSpellCheck?(enabled: boolean): void

  /**
   * 변환 없이 원시 콘텐츠를 가져옵니다
   * 디버깅과 직접 접근에 사용됩니다
   */
  getRawContent(): string

  /**
   * 변환 없이 원시 콘텐츠를 설정합니다
   * 디버깅과 직접 접근에 사용됩니다
   *
   * @param content - 설정할 원시 콘텐츠
   */
  setRawContent(content: string): void

  /**
   * 이 편집 영역이 현재 표시되고 있는지 확인합니다
   */
  isVisible(): boolean

  /**
   * 이 편집 영역의 DOM 요소를 가져옵니다
   */
  getElement(): HTMLElement

  /**
   * 이 영역이 **자기 문서를 소유할 때만** 있습니다.
   *
   * 있으면 두 가지 뜻입니다 — 커맨드가 이 상태 위에서 돌아야 하고
   * (`registerModelCommands`), 되돌리기도 이 영역의 것입니다. 없으면 예전 길
   * (`execCommand` · 스냅샷 히스토리)이 그대로 맡습니다.
   */
  getStateHandle?(): StateHandle

  /**
   * 문서를 건드리지 않는 표시 — 찾기 강조가 씁니다
   */
  getHighlighter?(): Highlighter

  /**
   * 되돌리기 기록을 여기서 끊습니다 — 커맨드 경계가 부릅니다
   */
  closeHistoryGroup?(): void

  /**
   * `prosemirror-view` 의 이음매 — 플러그인이 키맵·입력 처리를 직접 답니다.
   *
   * 예전에는 DOM 이벤트를 버스로 옮겨 실었는데, PM 이 그 자리를 이미 갖고
   * 있어서 **두 번째 이음매**였습니다.
   */
  addPlugin?(plugin: PMPlugin): () => void

  /**
   * 상태가 바뀔 때마다 알립니다 — 자기 문서를 소유하는 영역만 있습니다.
   *
   * 트랜잭션 하나가 곧 "무엇이 바뀌었나" 의 답이라, 구독하는 쪽이 DOM 이벤트를
   * 종류별로 듣고 짐작할 필요가 없습니다.
   */
  subscribe?(listener: ModelListener): () => void

  /**
   * 리소스와 이벤트 리스너를 정리합니다
   */
  destroy(): void
}

/**
 * HTML 콘텐츠 변환기
 * 다양한 형식 간 변환을 처리합니다
 */
export interface ContentConverter {
  /**
   * HTML을 순수 텍스트로 변환합니다
   *
   * @param html - HTML 콘텐츠
   * @returns 순수 텍스트 콘텐츠
   */
  htmlToText(html: string): string

  /**
   * 순수 텍스트를 HTML로 변환합니다
   *
   * @param text - 순수 텍스트 콘텐츠
   * @returns HTML 콘텐츠
   */
  textToHTML(text: string): string

  /**
   * HTML 특수 문자를 이스케이프합니다
   *
   * @param text - 이스케이프할 텍스트
   * @returns 이스케이프된 텍스트
   */
  escapeHTML(text: string): string

  /**
   * HTML 특수 문자를 언이스케이프합니다
   *
   * @param html - 언이스케이프할 HTML
   * @returns 언이스케이프된 텍스트
   */
  unescapeHTML(html: string): string

  /**
   * 표시를 위해 HTML을 포맷합니다 (프리티 프린트)
   *
   * @param html - 포맷할 HTML
   * @returns 포맷된 HTML
   */
  formatHTML(html: string): string
}

/**
 * `EditingAreaManager` 설정
 */
export interface EditingAreaManagerConfig {
  /**
   * 모든 편집 영역의 컨테이너 요소
   */
  container: HTMLElement

  /**
   * 기본 편집 모드
   */
  defaultMode?: EditingMode

  /**
   * 최소 높이 (픽셀)
   */
  minHeight?: number

  /**
   * 자동 크기 조정 활성화
   */
  autoResize?: boolean
}

/**
 * 모드 변경 이벤트 데이터
 */
/**
 * 콘텐츠 변경 이벤트 데이터
 */
/**
 * 크기 조정 이벤트 데이터
 */
