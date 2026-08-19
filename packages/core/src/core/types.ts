import type { Node as PMNode } from 'prosemirror-model'
import type { StateHandle } from '@/model/register'
import type { ModelListener } from '@/model/bridge'
import type { EventBus } from './event-bus'
import type { SelectionManager } from './selection-manager'
import type { CommandRegistry } from './command-registry'

/**
 * 편집 모드
 */
export type EditingMode = 'wysiwyg' | 'html' | 'text'

/**
 * 문서에 **손대지 않고** 칠하는 구간.
 *
 * 찾기 강조가 씁니다. 예전에는 `<span class="find-highlight">` 를 문서에
 * 끼워 넣었는데, 편집 영역이 문서 모델을 갖게 되면서 그 span 이 **문서의
 * 일부가 됩니다** — 스키마를 지나며 클래스는 떨어지고 배경색만 남아, 찾기를
 * 한 번 했다고 글에 형광펜이 칠해졌습니다. 저장물에도 들어갑니다.
 *
 * 위치는 모델 좌표입니다.
 */
export interface HighlightRange {
  from: number
  to: number
  className?: string
  style?: string
}

/**
 * 화면에만 있는 표시를 다루는 창구.
 *
 * 편집 영역이 문서 모델을 가질 때만 있습니다.
 */
export interface Highlighter {
  set(ranges: HighlightRange[]): void
  clear(): void
  /** 그 자리가 보이게 굴립니다 — 선택은 안 건드립니다 */
  scrollTo(pos: number): void
}

/**
 * 편집 영역 인터페이스
 *
 * 각 모드(`WYSIWYG`, `HTML`, `Text`)의 편집 영역이 구현해야 하는 기본 인터페이스
 */
export interface EditingArea {
  /** 편집 영역의 `DOM` 요소를 가져옵니다 */
  getElement(): HTMLElement

  /** 편집 영역에 포커스를 설정합니다 */
  focus(): void

  /** 편집 가능 여부를 설정합니다 */
  setEditable(enabled: boolean): void

  /** 지금 이 모드가 보고 있는 문서를 **모델로** 돌려줍니다 */
  getContent(): Promise<PMNode>

  /** 모델을 이 모드가 보여 줄 꼴로 옮깁니다 */
  setContent(content: PMNode): Promise<void>

  /** 편집 영역을 표시합니다 */
  show(): Promise<void>

  /** 편집 영역을 숨깁니다 */
  hide(): Promise<void>

  /** 편집 영역이 표시되고 있는지 확인합니다 */
  isVisible(): boolean

  /**
   * 이 영역이 **자기 문서를 소유할 때만** 있습니다.
   *
   * 있으면 커맨드가 이 상태 위에서 돌고(`registerModelCommands`) 되돌리기도
   * 이 영역의 것입니다. 없으면 예전 길(`execCommand` · 스냅샷 히스토리)이
   * 그대로 맡습니다.
   */
  getStateHandle?(): StateHandle

  /** 문서를 건드리지 않는 표시 — 찾기 강조가 씁니다 */
  getHighlighter?(): Highlighter

  /**
   * 상태가 바뀔 때마다 알립니다 — 자기 문서를 소유하는 영역만 있습니다.
   *
   * 트랜잭션 하나가 곧 "무엇이 바뀌었나" 의 답이라, 구독하는 쪽이 DOM 이벤트를
   * 종류별로 듣고 짐작할 필요가 없습니다.
   */
  subscribe?(listener: ModelListener): () => void

  /** 리소스를 정리합니다 */
  destroy(): void
}

/**
 * 편집 영역 관리자 인터페이스
 *
 * 여러 편집 모드를 관리하고 모드 간 전환을 처리합니다
 */
export interface EditingAreaManager {
  /** 편집 영역 매니저를 초기화합니다 */
  initialize(): Promise<void>

  /** 편집 모드를 전환합니다 */
  switchMode(newMode: EditingMode): Promise<void>

  /** 현재 편집 모드를 가져옵니다 */
  getCurrentMode(): EditingMode

  /** 현재 활성화된 편집 영역을 가져옵니다 */
  getCurrentArea(): EditingArea | undefined

  /** 지금 문서를 **모델로** 돌려줍니다 */
  getContent(): Promise<PMNode>

  /** 문서를 모델로 넣습니다 */
  setContent(content: PMNode): Promise<void>

  /** 편집 영역에 포커스를 설정합니다 */
  focus(): void

  /** 편집 가능 여부를 설정합니다 */
  setEditable(enabled: boolean): void

  /** 리소스를 정리합니다 */
  destroy(): void
}

/**
 * 플러그인 초기화 시 전달되는 에디터 컨텍스트
 *
 * 모든 핵심 서비스와 설정을 포함합니다
 */
export interface EditorContext {
  /** 플러그인 간 통신을 위한 이벤트 버스 */
  eventBus: EventBus

  /** 플러그인 매니저 인스턴스 */
  pluginManager?: PluginManager

  /** `WYSIWYG` 편집을 위한 선택 영역 관리자 */
  selectionManager?: SelectionManager

  /** 모드 전환을 위한 편집 영역 관리자 */
  editingAreaManager?: EditingAreaManager

  /** 커맨드 실행/조회를 위한 커맨드 레지스트리 */
  commandRegistry?: CommandRegistry

  /** 편집 가능한 요소 */
  element?: HTMLElement

  /** 에디터 설정 */
  config: EditorConfig

  /** 추가 속성을 동적으로 추가할 수 있습니다 */
  [key: string]: unknown
}

/**
 * 에디터 설정 옵션
 */
export interface EditorConfig {
  /** 디버그 모드 활성화 */
  debug?: boolean

  /** 지원되는 편집 모드 */
  modes?: ('wysiwyg' | 'html' | 'text')[]

  /** 추가 설정 */
  [key: string]: unknown
}

/**
 * 플러그인 인터페이스
 *
 * 모든 플러그인은 이 인터페이스를 구현해야 합니다
 */
export interface Plugin {
  /** 고유한 플러그인 이름 (예: `'text-style:bold'`) */
  name: string

  /** 선택적 플러그인 의존성 (다른 플러그인 이름들) */
  dependencies?: string[]

  /**
   * 플러그인을 초기화합니다
   *
   * 플러그인이 등록될 때 호출됩니다
   *
   * @param context 서비스가 포함된 에디터 컨텍스트
   * @returns 비동기 초기화를 위한 `void` 또는 `Promise<void>`
   */
  initialize(context: EditorContext): void | Promise<void>

  /**
   * 플러그인을 정리합니다
   *
   * 플러그인이 제거되거나 에디터가 종료될 때 호출됩니다
   * 이벤트 리스너, 타이머 등을 정리하는 데 사용합니다
   */
  destroy?(): void

  /** 플러그인 메타데이터 */
  version?: string
  author?: string
  description?: string
}

/**
 * 플러그인 매니저 인터페이스 (순환 의존성 회피)
 */
export interface PluginManager {
  register(plugin: Plugin): Promise<void>
  get(name: string): Plugin | undefined
  has(name: string): boolean
  remove(name: string): void
  destroyAll(): void
}

/**
 * UI integration formatting state
 *
 * Emitted via CoreEvents.FORMATTING_STATE_CHANGED
 */
export interface FormattingState {
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  isStrikeThrough: boolean
  isSubscript: boolean
  isSuperscript: boolean
}
