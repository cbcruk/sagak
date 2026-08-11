import type { Doc } from './doc'
import type { ChangeSet } from './change'
import { applyChanges } from './change'
import { mapPos } from './map'
import { readChanges, UnexpectedDom } from './read-dom'
import { readCaret, renderDoc, writeCaret } from './view'

/**
 * 화해 고리 (reconcile loop).
 *
 * ```
 * beforeinput   막지 않습니다. 커서 위치만 적어 둡니다
 *      ↓        브라우저가 DOM 을 고칩니다
 * input         DOM 을 읽어 변경 목록을 만듭니다
 *      ↓        모델에 적용합니다
 *      ↓        모델로 DOM 을 다시 그립니다 — 여기서 네이티브 선택이 죽습니다
 *      ↓        mapPos 로 커서를 되살립니다
 * ```
 *
 * ## 왜 `preventDefault` 를 안 하는가
 *
 * 이 스파이크의 출발점이 그 질문이었습니다. `test/composition.browser.test.ts`
 * 가 실제로 재 봅니다 — 일반 입력은 막을 수 있고, IME 조합 중 입력은
 * 막을 수 없습니다. 한쪽만 막는 설계는 두 갈래 코드가 되므로, 아예 둘 다
 * 놔두고 사후에 읽는 편이 낫습니다.
 *
 * ## 왜 조합 중에는 flush 하지 않는가
 *
 * `renderDoc` 은 문단을 통째로 새로 만듭니다. IME 가 조합 중인 텍스트 노드를
 * 갈아치우면 조합이 끊깁니다. 그래서 `compositionstart`~`compositionend`
 * 사이에는 모델을 건드리지 않고, 커밋된 뒤 한 번에 읽습니다.
 */

export interface FlushRecord {
  changes: ChangeSet
  /** 브라우저가 실제로 커서를 둔 자리 (재렌더 **전**, 새 좌표계) */
  browser: number | null
  /** `mapPos` 가 예측한 자리 */
  predicted: number | null
}

export interface EditorViewOptions {
  /**
   * 재렌더 뒤 커서를 되살릴지. `false` 로 두면 커서가 어떻게 죽는지
   * 볼 수 있습니다 — 대조군입니다.
   */
  restoreCaret?: boolean
}

export class EditorView {
  doc: Doc
  composing = false

  /** 반영된 flush 기록 — 예측과 실제를 비교하는 데 씁니다 */
  readonly flushes: FlushRecord[] = []
  /** 읽을 수 없었던 DOM — `<p>` 가 아닌 자식이 생긴 경우 */
  readonly rejected: UnexpectedDom[] = []

  private caretBefore: number | null = null
  private readonly restoreCaret: boolean

  constructor(
    readonly root: HTMLElement,
    doc: Doc,
    options: EditorViewOptions = {}
  ) {
    this.doc = doc
    this.restoreCaret = options.restoreCaret ?? true

    root.contentEditable = 'true'
    renderDoc(root, doc)

    root.addEventListener('beforeinput', this.onBeforeInput)
    root.addEventListener('input', this.onInput)
    root.addEventListener('compositionstart', this.onCompositionStart)
    root.addEventListener('compositionend', this.onCompositionEnd)
  }

  destroy(): void {
    this.root.removeEventListener('beforeinput', this.onBeforeInput)
    this.root.removeEventListener('input', this.onInput)
    this.root.removeEventListener('compositionstart', this.onCompositionStart)
    this.root.removeEventListener('compositionend', this.onCompositionEnd)
  }

  /**
   * 입력을 **막지 않습니다.** 브라우저가 DOM 을 고치기 직전의 커서만
   * 적어 둡니다 — 이때는 DOM 과 모델이 같으므로 이 값이 모델 좌표입니다.
   */
  private onBeforeInput = (): void => {
    /*
     * **조합 중에만 첫 값을 지킵니다.**
     *
     * 조합은 `beforeinput` 을 여러 번 보내는데 그때 DOM 에는 이미 조합 글자가
     * 들어 있어서, 다시 읽으면 "편집 전" 이 아니라 "편집 중" 이 됩니다.
     *
     * 반대로 조합이 아닐 때 값을 지키면 **낡은 커서가 남습니다.** 브라우저가
     * `beforeinput` 을 보내 놓고 아무것도 안 바꾸는 경우가 있기 때문입니다 —
     * 문서 맨 앞에서 Backspace 를 누르면 그렇습니다. 그러면 `input` 이 오지
     * 않아 `flush()` 가 돌지 않고, 적어 둔 커서가 지워지지 않은 채 남아
     * **다음 편집의 예측을 망칩니다.**
     *
     * 씨앗 60개 × 60걸음짜리 편집 열이 이걸 잡았습니다. 25개 × 40걸음
     * 에서는 안 나왔습니다.
     */
    if (this.composing && this.caretBefore !== null) return
    this.caretBefore = readCaret(this.root)
  }

  private onInput = (): void => {
    if (this.composing) return
    this.flush()
  }

  private onCompositionStart = (): void => {
    this.composing = true
  }

  private onCompositionEnd = (): void => {
    this.composing = false
    // 크롬은 compositionend 다음에 input 을 한 번 더 보냅니다. 그때는
    // 읽을 변경이 없어 no-op 이 되므로 여기서 먼저 처리해도 안전합니다.
    this.flush()
  }

  /**
   * DOM 을 읽어 모델에 반영하고 다시 그립니다.
   *
   * 읽을 수 없는 DOM 은 거부하고 **모델로 DOM 을 되돌립니다.** 조용히
   * 갈라지게 두면 그 뒤의 모든 좌표가 틀어지므로, 눈에 보이게 실패하는
   * 편이 낫습니다.
   */
  flush(): FlushRecord | null {
    /*
     * 재렌더 **전**에 읽습니다 — 브라우저가 편집 직후 커서를 어디에 뒀는지.
     *
     * 예측이 맞았는지 채점하는 데도 쓰지만, 그 전에 **진단을 보정하는 데**
     * 씁니다. 같은 글자가 이어질 때 어디에 쳤는지는 문자열이 말해 주지
     * 않고 브라우저만 압니다.
     */
    const browser = readCaret(this.root)

    let changes: ChangeSet

    try {
      changes = readChanges(this.root, this.doc, browser ?? undefined)
    } catch (error) {
      if (error instanceof UnexpectedDom) {
        this.rejected.push(error)
        renderDoc(this.root, this.doc)
        if (this.restoreCaret && this.caretBefore !== null) {
          writeCaret(this.root, this.caretBefore)
        }
        this.caretBefore = null
        return null
      }
      throw error
    }

    if (changes.length === 0) {
      this.caretBefore = null
      return null
    }

    const predicted =
      this.caretBefore === null ? null : mapPos(this.caretBefore, changes, 1)

    this.doc = applyChanges(this.doc, changes)
    renderDoc(this.root, this.doc)

    const target = predicted ?? browser
    if (this.restoreCaret && target !== null) writeCaret(this.root, target)

    this.caretBefore = null

    const record: FlushRecord = { changes, browser, predicted }
    this.flushes.push(record)
    return record
  }
}
