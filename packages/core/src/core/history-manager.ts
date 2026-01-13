/**
 * 편집기 상태 인터페이스
 *
 * 특정 시점의 편집기 상태를 나타냅니다.
 *
 * @property content 편집기의 `HTML` 컨텐츠
 * @property selection 선택 영역 정보 (선택적)
 * @property selection.start 선택 시작 오프셋
 * @property selection.end 선택 종료 오프셋
 * @property timestamp 상태가 캡처된 시각 (밀리초)
 */
export interface HistoryState {
  content: string
  selection?: {
    start: number
    end: number
  }
  timestamp: number
}

/**
 * `HistoryManager` 옵션 인터페이스
 *
 * @property maxSize 저장할 최대 히스토리 개수 (기본값: `100`) 메모리 사용량을 제한하기 위한 설정
 */
export interface HistoryManagerOptions {
  maxSize?: number
}

/**
 * `HistoryManager` 클래스
 *
 * 핵심 동작 원리:
 * 1. 새 상태 추가: 현재 상태를 `undo` 스택에 저장하고, `redo` 스택 초기화
 * 2. `Undo` 실행: `undo` 스택에서 꺼내 현재로 만들고, 이전 현재를 `redo` 스택에 저장
 * 3. `Redo` 실행: `redo` 스택에서 꺼내 현재로 만들고, 이전 현재를 `undo` 스택에 저장
 *
 * **메모리 관리:**
 * - `maxSize`로 히스토리 크기 제한 (기본값: `100`)
 * - 동일한 컨텐츠의 연속 상태는 저장하지 않음 (메모리 최적화)
 *
 * @example
 * ```typescript
 * // 히스토리 매니저 생성
 * const history = new HistoryManager({ maxSize: 50 });
 *
 * // 새로운 상태 추가
 * history.push({
 *   content: '<p>Hello</p>',
 *   timestamp: Date.now()
 * });
 *
 * // Undo - 이전 상태로 복원
 * const previousState = history.undo();
 * if (previousState) {
 *   editor.setContent(previousState.content);
 * }
 *
 * // Redo - 취소한 작업 다시 실행
 * const nextState = history.redo();
 * ```
 *
 * @see {@link HistoryState} 저장되는 상태 형식
 * @see {@link HistoryManagerOptions} 설정 옵션
 */
export class HistoryManager {
  /** `Undo` 스택 - 과거 상태들을 저장 */
  private undoStack: HistoryState[] = []

  /** `Redo` 스택 - 취소된 상태들을 저장 */
  private redoStack: HistoryState[] = []

  /** 현재 편집기 상태 */
  private currentState: HistoryState | null = null

  /** 최대 히스토리 크기 */
  private maxSize: number

  constructor(options: HistoryManagerOptions = {}) {
    this.maxSize = options.maxSize || 100
  }

  /**
   * 새로운 상태를 히스토리에 추가
   *
   * **동작 과정:**
   * 1. 현재 상태와 동일한 컨텐츠인지 확인 (중복 방지)
   * 2. 현재 상태를 `undo` 스택에 저장
   * 3. `maxSize` 초과 시 가장 오래된 상태 제거 (`FIFO`)
   * 4. 새 상태를 현재 상태로 설정
   * 5. `Redo` 스택 초기화 (새로운 히스토리 브랜치 시작)
   *
   * **Why `Redo` 스택을 초기화?**
   * 히스토리 분기를 방지합니다. 사용자가 `undo` 후 새로운 작업을 하면
   * 이전 `redo` 히스토리는 더 이상 유효하지 않기 때문입니다.
   *
   * @param state 저장할 편집기 상태
   *
   * @example
   * ```typescript
   * history.push({
   *   content: '<p>새로운 내용</p>',
   *   timestamp: Date.now()
   * });
   * ```
   */
  push(state: HistoryState): void {
    if (this.currentState && this.currentState.content === state.content) {
      return
    }

    if (this.currentState) {
      this.undoStack.push(this.currentState)

      if (this.undoStack.length > this.maxSize) {
        this.undoStack.shift()
      }
    }

    this.currentState = state
    this.redoStack = []
  }

  /**
   * `Undo` - 이전 상태로 복원
   *
   * **동작 과정:**
   * 1. `Undo` 스택이 비어있으면 `null` 반환
   * 2. 현재 상태를 `redo` 스택에 저장 (나중에 `redo` 가능하도록)
   * 3. `Undo` 스택에서 이전 상태를 꺼냄 (`pop`)
   * 4. 이전 상태를 현재 상태로 설정
   * 5. 복원된 상태 반환
   *
   * @returns 이전 상태, 또는 `undo` 히스토리가 없으면 `null`
   *
   * @example
   * ```typescript
   * const prevState = history.undo();
   * if (prevState) {
   *   console.log('이전 상태로 복원:', prevState.content);
   * } else {
   *   console.log('더 이상 undo할 수 없습니다');
   * }
   * ```
   */
  undo(): HistoryState | null {
    if (this.undoStack.length === 0) {
      return null
    }

    if (this.currentState) {
      this.redoStack.push(this.currentState)
    }

    this.currentState = this.undoStack.pop()!
    return this.currentState
  }

  /**
   * `Redo` - 취소한 작업을 다시 실행
   *
   * **동작 과정:**
   * 1. `Redo` 스택이 비어있으면 `null` 반환
   * 2. 현재 상태를 `undo` 스택에 저장
   * 3. `Redo` 스택에서 다음 상태를 꺼냄 (`pop`)
   * 4. 다음 상태를 현재 상태로 설정
   * 5. 복원된 상태 반환
   *
   * @returns 다음 상태, 또는 `redo` 히스토리가 없으면 `null`
   *
   * @example
   * ```typescript
   * const nextState = history.redo();
   * if (nextState) {
   *   console.log('다시 실행:', nextState.content);
   * } else {
   *   console.log('더 이상 redo할 수 없습니다');
   * }
   * ```
   */
  redo(): HistoryState | null {
    if (this.redoStack.length === 0) {
      return null
    }

    if (this.currentState) {
      this.undoStack.push(this.currentState)
    }

    this.currentState = this.redoStack.pop()!
    return this.currentState
  }

  /**
   * `Undo` 가능 여부 확인
   *
   * @returns `Undo` 스택에 상태가 있으면 `true`
   */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /**
   * `Redo` 가능 여부 확인
   *
   * @returns `Redo` 스택에 상태가 있으면 `true`
   */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /**
   * 현재 상태 조회
   *
   * @returns 현재 편집기 상태, 또는 상태가 없으면 `null`
   */
  getCurrentState(): HistoryState | null {
    return this.currentState
  }

  /**
   * 모든 히스토리 초기화
   *
   * `Undo`/`Redo` 스택과 현재 상태를 모두 제거합니다.
   * 주로 에디터를 리셋하거나 새 문서를 시작할 때 사용합니다.
   *
   * @example
   * ```typescript
   * history.clear();
   * console.log(history.canUndo()); // false
   * console.log(history.canRedo()); // false
   * ```
   */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.currentState = null
  }

  /**
   * `Undo` 스택 크기 조회
   *
   * @returns `Undo` 스택에 저장된 상태 개수
   */
  getUndoSize(): number {
    return this.undoStack.length
  }

  /**
   * `Redo` 스택 크기 조회
   *
   * @returns `Redo` 스택에 저장된 상태 개수
   */
  getRedoSize(): number {
    return this.redoStack.length
  }
}
