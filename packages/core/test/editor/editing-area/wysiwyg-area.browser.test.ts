import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WysiwygArea } from '@/editor/editing-area/modes/wysiwyg-area'
import { EventBus } from '@/core/event-bus'
import { TextSelection } from 'prosemirror-state'
import type { WysiwygAreaConfig } from '@/editor/editing-area/modes/wysiwyg-area'
import type { Node as PMNode } from 'prosemirror-model'
import { sagakSchema } from '@/model/schema'
import { parseHtml, toHtml } from '@/model/storage'

/*
 * 이 검사들은 계속 **HTML 로 말합니다.**
 *
 * 편집 영역이 주고받는 것은 이제 문서 모델이지만, 여기서 재려는 것은 모드
 * 사이에서 내용이 보존되는가이지 모델의 모양이 아닙니다. 그래서 경계에서만
 * 옮기고 검사 본문은 읽던 대로 둡니다.
 *
 * 다만 **어느 HTML 인지가 바뀌었습니다.** `getRawContent()` 는 더 이상
 * `innerHTML` 이 아니라 모델을 직렬화한 것입니다. PM 이 그린 DOM 에는
 * `ProseMirror` 클래스와 표시용 `<br>` 이 섞여 있어 그대로 읽으면 편집기
 * 사정이 검사에 새어 들어옵니다.
 */
const doc = (html: string) => parseHtml(html, sagakSchema, document)
const asHtml = (node: PMNode) => toHtml(node, sagakSchema, document)


/**
 * WysiwygArea 테스트
 *
 * Why: contentEditable 기반 WYSIWYG 편집 영역의 기능 검증
 * How: DOM 조작, 이벤트 처리, SelectionManager 통합 테스트
 */
describe('WysiwygArea', () => {
  let container: HTMLDivElement
  let wysiwygArea: WysiwygArea

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (wysiwygArea) {
      wysiwygArea.destroy()
    }
    document.body.removeChild(container)
  })

  describe('초기화 (편집 영역 설정)', () => {
    /**
     * Why: 사용자가 리치 텍스트를 편집할 수 있는 WYSIWYG 영역이 필요
     * How: `WysiwygArea` 생성자로 contentEditable div 생성, iframe 사용 안함
     */

    it('contentEditable div를 생성해야 함', () => {
      // Given: 컨테이너가 포함된 config
      const config: WysiwygAreaConfig = { container }

      // When: WysiwygArea 생성
      wysiwygArea = new WysiwygArea(config)

      // Then: contentEditable이 true인 div가 생성됨
      const div = container.querySelector('div')
      expect(div).toBeDefined()
      expect(div?.contentEditable).toBe('true')
    })

    it('iframe를 사용하지 않아야 함', () => {
      // Given: 기본 config
      const config: WysiwygAreaConfig = { container }

      // When: WysiwygArea 생성
      wysiwygArea = new WysiwygArea(config)

      // Then: iframe이 생성되지 않음 (최신 접근 방식)
      const iframe = container.querySelector('iframe')
      expect(iframe).toBeNull()
    })

    it('사용자 정의 className을 적용해야 함', () => {
      // Given: className이 지정된 config
      const config: WysiwygAreaConfig = {
        container,
        className: 'custom-wysiwyg',
      }

      // When: WysiwygArea 생성
      wysiwygArea = new WysiwygArea(config)

      /*
       * PM 이 자기 클래스(`ProseMirror`)를 같이 답니다 — 스타일시트가 그
       * 이름으로 걸려 있어 없으면 편집 표면이 망가집니다. 우리 이름이 남아
       * 있는지만 봅니다.
       */
      const div = wysiwygArea.getElement()
      expect(div.className).toContain('custom-wysiwyg')
    })

    it('minHeight를 적용해야 함', () => {
      // Given: minHeight가 지정된 config
      const config: WysiwygAreaConfig = {
        container,
        minHeight: 400,
      }

      // When: WysiwygArea 생성
      wysiwygArea = new WysiwygArea(config)

      // Then: minHeight 스타일이 적용됨
      const div = wysiwygArea.getElement()
      expect(div.style.minHeight).toBe('400px')
    })

    it('기본적으로 숨겨져 있어야 함', () => {
      // Given: 기본 config
      const config: WysiwygAreaConfig = { container }

      // When: WysiwygArea 생성
      wysiwygArea = new WysiwygArea(config)

      // Then: 숨김 상태로 생성됨
      expect(wysiwygArea.isVisible()).toBe(false)
      const div = wysiwygArea.getElement()
      expect(div.style.display).toBe('none')
    })

    it('기본 콘텐츠를 가져야 함', () => {
      // Given: 기본 config
      const config: WysiwygAreaConfig = { container }

      // When: WysiwygArea 생성
      wysiwygArea = new WysiwygArea(config)

      /*
       * 빈 문단 하나입니다. 캐럿 자리를 만드는 `<br>` 은 PM 이 DOM 에만 넣고
       * 모델에는 안 넣습니다 — 저장물에 안 남는다는 뜻입니다.
       */
      const content = wysiwygArea.getRawContent()
      expect(content).toBe('<p></p>')
    })
  })

  describe('콘텐츠 관리 (HTML 저장 및 조회)', () => {
    /**
     * Why: WYSIWYG 편집 결과를 HTML 형식으로 저장하고 조회해야 함
     * How: `setContent()`/`getContent()`로 IR 형식(HTML) 저장/조회, 빈 콘텐츠 정규화
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('원시 콘텐츠를 설정하고 가져올 수 있어야 함', () => {
      // Given: HTML 문자열

      // When: setRawContent로 설정
      wysiwygArea.setRawContent('<p>Hello World</p>')

      // Then: getRawContent로 동일한 값 조회
      expect(wysiwygArea.getRawContent()).toBe('<p>Hello World</p>')
    })

    it('콘텐츠를 HTML로 가져올 수 있어야 함', async () => {
      // Given: HTML이 설정된 상태
      wysiwygArea.setRawContent('<p>Hello World</p>')

      // When: getContent 호출
      const content = asHtml(await wysiwygArea.getContent())

      // Then: 설정한 HTML이 반환됨
      expect(content).toBe('<p>Hello World</p>')
    })

    it('HTML로부터 콘텐츠를 설정할 수 있어야 함', async () => {
      // Given: HTML 문자열

      // When: setContent로 HTML 설정
      await wysiwygArea.setContent(doc('<p>Hello World</p>'))

      // Then: 설정한 HTML이 저장됨
      expect(wysiwygArea.getRawContent()).toBe('<p>Hello World</p>')
    })

    it('빈 콘텐츠를 처리해야 함', async () => {
      // Given: 빈 문자열

      // When: setContent로 빈 콘텐츠 설정
      await wysiwygArea.setContent(doc(''))

      expect(wysiwygArea.getRawContent()).toBe('<p></p>')
      expect(asHtml(await wysiwygArea.getContent())).toBe('<p></p>')
    })

    it('<br>을 빈 콘텐츠로 처리해야 함', async () => {
      // Given: br 태그만 있는 HTML

      // When: setContent로 설정
      await wysiwygArea.setContent(doc('<br>'))

      /* 채움용 `<br>` 이라 모델에는 안 들어갑니다 — 표시에만 있습니다 */
      expect(wysiwygArea.getRawContent()).toBe('<p></p>')
      expect(asHtml(await wysiwygArea.getContent())).toBe('<p></p>')
    })

    it('<p></p>를 빈 콘텐츠로 처리해야 함', async () => {
      // Given: 빈 p 태그

      // When: setContent로 설정
      await wysiwygArea.setContent(doc('<p></p>'))

      expect(wysiwygArea.getRawContent()).toBe('<p></p>')
      expect(asHtml(await wysiwygArea.getContent())).toBe('<p></p>')
    })

    it('리치 콘텐츠를 보존해야 함', async () => {
      // Given: 서식 태그가 포함된 HTML
      const html = '<p>Hello <strong>World</strong></p>'

      // When: setContent로 설정
      await wysiwygArea.setContent(doc(html))

      // Then: 서식이 보존됨
      expect(wysiwygArea.getRawContent()).toBe(html)
    })

    it('여러 단락을 보존해야 함', async () => {
      // Given: 여러 p 태그로 구성된 HTML
      const html = '<p>Paragraph 1</p><p>Paragraph 2</p>'

      // When: setContent로 설정
      await wysiwygArea.setContent(doc(html))

      // Then: 단락 구조가 보존됨
      expect(wysiwygArea.getRawContent()).toBe(html)
    })
  })

  describe('표시 관리 (show/hide 동작)', () => {
    /**
     * Why: 모드 전환 시 WYSIWYG 영역을 표시하거나 숨겨야 함
     * How: `show()`/`hide()`로 display 스타일 제어, `EventBus`로 이벤트 발행
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('WYSIWYG 영역을 표시해야 함', async () => {
      // Given: 숨겨진 상태의 WysiwygArea

      // When: show 호출
      await wysiwygArea.show()

      // Then: 표시 상태로 변경됨
      expect(wysiwygArea.isVisible()).toBe(true)
      const div = wysiwygArea.getElement()
      expect(div.style.display).toBe('block')
    })

    it('WYSIWYG 영역을 숨겨야 함', async () => {
      // Given: 표시된 상태의 WysiwygArea
      await wysiwygArea.show()

      // When: hide 호출
      await wysiwygArea.hide()

      // Then: 숨김 상태로 변경됨
      expect(wysiwygArea.isVisible()).toBe(false)
      const div = wysiwygArea.getElement()
      expect(div.style.display).toBe('none')
    })

    it('show 시 이벤트를 발행해야 함', async () => {
      // Given: EventBus와 SHOWN 핸들러가 설정된 WysiwygArea
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_AREA_SHOWN', 'on', handler)

      const config: WysiwygAreaConfig = { container, eventBus }
      wysiwygArea = new WysiwygArea(config)

      // When: show 호출
      await wysiwygArea.show()

      // Then: WYSIWYG_AREA_SHOWN 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })

    it('hide 시 이벤트를 발행해야 함', async () => {
      // Given: EventBus와 HIDDEN 핸들러가 설정된 WysiwygArea
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_AREA_HIDDEN', 'on', handler)

      const config: WysiwygAreaConfig = { container, eventBus }
      wysiwygArea = new WysiwygArea(config)

      await wysiwygArea.show()

      // When: hide 호출
      await wysiwygArea.hide()

      // Then: WYSIWYG_AREA_HIDDEN 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })
  })

  describe('포커스 관리 (focus 제어)', () => {
    /**
     * Why: 사용자가 WYSIWYG 영역에서 바로 편집을 시작할 수 있어야 함
     * How: `focus()` 메서드로 contentEditable div에 포커스
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('요소에 포커스를 설정해야 함', () => {
      // Given: 생성된 WysiwygArea

      // When: focus 호출
      // Then: 오류 없이 실행됨
      expect(() => {
        wysiwygArea.focus()
      }).not.toThrow()
    })
  })

  describe('편집 가능 상태 (contentEditable 제어)', () => {
    /**
     * Why: 읽기 전용 모드에서 편집을 방지해야 함
     * How: `setEditable()`로 contentEditable 속성 변경
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('기본적으로 편집 가능해야 함', () => {
      // Given: 생성된 WysiwygArea

      // When: contentEditable 속성 확인

      // Then: contentEditable이 'true'임
      const div = wysiwygArea.getElement()
      expect(div.contentEditable).toBe('true')
    })

    it('편집을 비활성화할 수 있어야 함', () => {
      // Given: 생성된 WysiwygArea

      // When: setEditable(false) 호출
      wysiwygArea.setEditable(false)

      // Then: contentEditable이 'false'로 변경됨
      const div = wysiwygArea.getElement()
      expect(div.contentEditable).toBe('false')
    })

    it('편집을 활성화할 수 있어야 함', () => {
      // Given: 편집이 비활성화된 WysiwygArea
      wysiwygArea.setEditable(false)

      // When: setEditable(true) 호출
      wysiwygArea.setEditable(true)

      // Then: contentEditable이 'true'로 변경됨
      const div = wysiwygArea.getElement()
      expect(div.contentEditable).toBe('true')
    })
  })

  describe('요소 접근 (getElement)', () => {
    /**
     * Why: 외부에서 contentEditable 요소에 직접 접근해야 하는 경우가 있음
     * How: `getElement()`로 contentEditable div 반환
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('contentEditable 요소를 반환해야 함', () => {
      // Given: 생성된 WysiwygArea

      // When: getElement 호출
      const element = wysiwygArea.getElement()

      // Then: contentEditable이 true인 HTMLDivElement가 반환됨
      expect(element).toBeInstanceOf(HTMLDivElement)
      expect(element.contentEditable).toBe('true')
    })
  })

  describe('명령 실행 (execCommand)', () => {
    /**
     * Why: 사용자가 서식(bold, italic 등)을 적용할 수 있어야 함
     * How: `execCommand()`로 document.execCommand 실행
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('bold 명령을 실행해야 함', () => {
      // Given: 텍스트가 선택된 상태의 WysiwygArea
      wysiwygArea.show()
      wysiwygArea.focus()

      const element = wysiwygArea.getElement()
      element.innerHTML = '<p>Hello World</p>'
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: bold 명령 실행
      const result = wysiwygArea.execCommand('bold')

      // Then: 명령이 성공적으로 실행됨
      expect(result).toBe(true)
    })

    it('italic 명령을 실행해야 함', () => {
      // Given: 텍스트가 선택된 상태의 WysiwygArea
      wysiwygArea.show()
      wysiwygArea.focus()

      const element = wysiwygArea.getElement()
      element.innerHTML = '<p>Hello World</p>'
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: italic 명령 실행
      const result = wysiwygArea.execCommand('italic')

      // Then: 명령이 성공적으로 실행됨
      expect(result).toBe(true)
    })

    it('값이 있는 명령을 실행해야 함', () => {
      // Given: 텍스트가 선택된 상태의 WysiwygArea
      wysiwygArea.show()
      wysiwygArea.focus()

      const element = wysiwygArea.getElement()
      element.innerHTML = '<p>Hello World</p>'
      const textNode = element.firstChild!.firstChild as Text
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // When: foreColor 명령을 값과 함께 실행
      const result = wysiwygArea.execCommand('foreColor', 'red')

      // Then: 명령이 성공적으로 실행됨
      expect(result).toBe(true)
    })
  })

  describe('선택과 삽입 — 모델 위에서', () => {
    /**
     * Why: 예전에는 이 여섯이 `SelectionManager` 를 거쳐 DOM 을 직접 고쳤습니다.
     *      PM 이 DOM 을 소유한 뒤로 그 길은 모델을 지나지 않아 위험합니다.
     * How: `state.selection` 과 트랜잭션으로 옮기고, 결과를 **모델에서** 읽습니다
     */

    beforeEach(() => {
      wysiwygArea = new WysiwygArea({ container })
    })

    /** 문서를 놓고 전체를 고릅니다 — 툴바를 누르기 직전 모양입니다 */
    const selectAll = () => {
      const handle = wysiwygArea.getStateHandle()
      const state = handle.getState()!

      handle.dispatch(
        state.tr.setSelection(
          TextSelection.create(state.doc, 1, state.doc.content.size - 1)
        )
      )
    }

    it('선택 자리에 HTML 을 넣습니다', () => {
      wysiwygArea.setRawContent('<p>가나다라</p>')
      selectAll()

      expect(wysiwygArea.insertHTML('<strong>굵게</strong>')).toBe(true)
      expect(wysiwygArea.getRawContent()).toBe('<p><strong>굵게</strong></p>')
    })

    it('선택 자리에 글자를 넣습니다', () => {
      wysiwygArea.setRawContent('<p>가나다라</p>')
      selectAll()

      expect(wysiwygArea.insertText('마바')).toBe(true)
      expect(wysiwygArea.getRawContent()).toBe('<p>마바</p>')
    })

    it('선택된 글자와 HTML 을 읽습니다', () => {
      wysiwygArea.setRawContent('<p><strong>가나</strong>다라</p>')
      selectAll()

      expect(wysiwygArea.getSelectedText()).toBe('가나다라')
      expect(wysiwygArea.getSelectedHTML()).toContain('<strong>가나</strong>')
    })

    /**
     * Why: 대화상자가 포커스를 가져가는 동안 자리를 붙들어야 합니다
     * How: 노드가 아니라 **위치 정수 둘**이라 DOM 이 다시 그려져도 살아남습니다
     */
    it('선택을 저장하고 되돌립니다', () => {
      wysiwygArea.setRawContent('<p>가나다라</p>')
      selectAll()
      wysiwygArea.saveSelection()

      const handle = wysiwygArea.getStateHandle()
      handle.dispatch(
        handle.getState()!.tr.setSelection(
          TextSelection.create(handle.getState()!.doc, 1)
        )
      )
      expect(handle.getState()!.selection.empty).toBe(true)

      wysiwygArea.restoreSelection()

      expect(wysiwygArea.getSelectedText()).toBe('가나다라')
    })

    it('IME 조합 여부를 뷰에서 읽습니다', () => {
      expect(wysiwygArea.isComposing()).toBe(false)
    })
  })

  describe('되돌리기 — 뷰가 갖습니다', () => {
    /**
     * Why: 스냅샷 히스토리는 `innerHTML` 을 통째로 갈아 끼워 모델과 어긋납니다
     * How: `prosemirror-history` 를 뷰에 달고, 버스의 `UNDO`/`REDO` 로만 부릅니다
     */

    let eventBus: EventBus

    beforeEach(() => {
      eventBus = new EventBus()
      wysiwygArea = new WysiwygArea({ container, eventBus })
    })

    const type = (text: string) => {
      const handle = wysiwygArea.getStateHandle()
      handle.dispatch(handle.getState()!.tr.insertText(text, 1))
    }

    it('되돌리고 다시 합니다', () => {
      type('가나')
      expect(wysiwygArea.getRawContent()).toBe('<p>가나</p>')

      eventBus.emit('UNDO')
      expect(wysiwygArea.getRawContent()).toBe('<p></p>')

      eventBus.emit('REDO')
      expect(wysiwygArea.getRawContent()).toBe('<p>가나</p>')
    })

    it('되돌릴 수 있는지 알립니다', () => {
      const seen: Array<{ canUndo: boolean; canRedo: boolean }> = []
      eventBus.on('HISTORY_STATE_CHANGED', 'on', (state) => {
        seen.push({ canUndo: state.canUndo, canRedo: state.canRedo })
      })

      type('가')

      expect(seen.at(-1)).toEqual({ canUndo: true, canRedo: false })

      eventBus.emit('UNDO')

      expect(seen.at(-1)).toEqual({ canUndo: false, canRedo: true })
    })

    /**
     * Why: 다른 문서를 열고 나서 이전 문서로 되돌아가면 안 됩니다
     * How: `setContent` 는 상태를 새로 만듭니다 — 기록도 같이 새로 시작합니다
     */
    it('문서를 갈아 끼우면 기록이 비워집니다', () => {
      type('가나')
      wysiwygArea.setRawContent('<p>다른 문서</p>')

      eventBus.emit('UNDO')

      expect(wysiwygArea.getRawContent()).toBe('<p>다른 문서</p>')
    })
  })

  describe('이벤트 발행 (EventBus 통합)', () => {
    /**
     * Why: WYSIWYG 영역의 변경 사항을 다른 컴포넌트에 알려야 함
     * How: DOM 이벤트 리스너로 이벤트 포착 후 `EventBus`로 발행
     */

    it('콘텐츠 변경 이벤트를 발행해야 함', () => {
      // Given: EventBus와 CONTENT_CHANGED 핸들러가 설정된 WysiwygArea
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_CONTENT_CHANGED', 'on', handler)

      const config: WysiwygAreaConfig = { container, eventBus }
      wysiwygArea = new WysiwygArea(config)

      /*
       * **DOM 이벤트가 아니라 트랜잭션이 신호입니다.**
       *
       * 예전에는 `input` 을 듣고 "뭔가 바뀌었나 보다" 했습니다. 이제는 문서를
       * 바꾼 트랜잭션 자신이 무엇이 바뀌었는지 알고 있어 짐작할 일이 없습니다.
       */
      const handle = wysiwygArea.getStateHandle()
      handle.dispatch(handle.getState()!.tr.insertText('가', 1))

      // Then: WYSIWYG_CONTENT_CHANGED 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })

    /**
     * Why: 매 키 입력마다 문서 전체를 직렬화하면 문서 크기에 비례해 느려집니다.
     *      재 보니 2000문단(222 KB)에서 키 하나당 0.925 ms 였고, 정작 구독자
     *      둘 다(`EditorCore`, 자동 저장) 이 값을 읽지 않았습니다.
     * How: `innerHTML` 게터를 세어, 페이로드를 읽기 전에는 0 인지 확인
     */
    it('콘텐츠를 읽기 전에는 직렬화하지 않아야 함', () => {
      // Given: 내용이 있는 WysiwygArea
      const eventBus = new EventBus()
      wysiwygArea = new WysiwygArea({ container, eventBus })
      wysiwygArea.setRawContent('<p>글자가 좀 있는 문단입니다</p>')

      let payload: { content: string } | undefined
      eventBus.on('WYSIWYG_CONTENT_CHANGED', 'on', (data) => {
        payload = data
      })

      // When: 입력이 열 번 일어나되 아무도 content 를 읽지 않음
      const handle = wysiwygArea.getStateHandle()
      for (let i = 0; i < 10; i += 1) {
        handle.dispatch(handle.getState()!.tr.insertText('가', 1))
      }

      /*
       * Then: 페이로드에 **값이 아니라 게터**가 들어 있어야 합니다.
       *
       * 전에는 `innerHTML` 읽기 횟수를 셌지만 이제 직렬화는 모델에서 일어나
       * 셀 자리가 없습니다. 대신 계약 자체를 봅니다 — 프로퍼티가 게터라는 것이
       * 곧 "읽기 전에는 아무 일도 안 한다" 입니다.
       */
      const descriptor = Object.getOwnPropertyDescriptor(payload!, 'content')!
      expect(typeof descriptor.get).toBe('function')
      expect(descriptor.value).toBeUndefined()

      // 그리고 읽으면 그때 제대로 나와야 합니다 (계약은 그대로)
      expect(payload?.content).toContain('문단입니다')
    })

    it('포커스 이벤트를 발행해야 함', () => {
      // Given: EventBus와 FOCUSED 핸들러가 설정된 WysiwygArea
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_FOCUSED', 'on', handler)

      const config: WysiwygAreaConfig = { container, eventBus }
      wysiwygArea = new WysiwygArea(config)

      // When: focus 이벤트 발생
      const div = wysiwygArea.getElement()
      div.dispatchEvent(new Event('focus', { bubbles: true }))

      // Then: WYSIWYG_FOCUSED 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })

    it('블러 이벤트를 발행해야 함', () => {
      // Given: EventBus와 BLURRED 핸들러가 설정된 WysiwygArea
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_BLURRED', 'on', handler)

      const config: WysiwygAreaConfig = { container, eventBus }
      wysiwygArea = new WysiwygArea(config)

      // When: blur 이벤트 발생
      const div = wysiwygArea.getElement()
      div.dispatchEvent(new Event('blur', { bubbles: true }))

      // Then: WYSIWYG_BLURRED 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })

    it('키다운 이벤트를 발행해야 함', () => {
      // Given: EventBus와 KEYDOWN 핸들러가 설정된 WysiwygArea
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_KEYDOWN', 'on', handler)

      const config: WysiwygAreaConfig = { container, eventBus }
      wysiwygArea = new WysiwygArea(config)

      // When: keydown 이벤트 발생
      const div = wysiwygArea.getElement()
      div.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))

      // Then: WYSIWYG_KEYDOWN 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })
  })

  describe('리소스 정리 (destroy)', () => {
    /**
     * Why: 메모리 누수를 방지하기 위해 리소스를 정리해야 함
     * How: `destroy()`로 DOM에서 요소 제거
     */

    it('destroy 시 요소를 제거해야 함', () => {
      // Given: 생성된 WysiwygArea
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)

      const element = wysiwygArea.getElement()
      expect(element.parentNode).toBe(container)

      // When: destroy 호출
      wysiwygArea.destroy()

      // Then: 요소가 DOM에서 제거됨
      expect(element.parentNode).toBeNull()
    })
  })

  describe('자동 크기 조정 (autoResize)', () => {
    /**
     * Why: 콘텐츠 양에 따라 편집 영역 높이가 자동 조정되면 편집이 편리함
     * How: ResizeObserver로 콘텐츠에 따라 자동 크기 조정
     */

    it('autoResize 옵션을 지원해야 함', () => {
      // Given: autoResize가 활성화된 config
      const config: WysiwygAreaConfig = {
        container,
        autoResize: true,
      }

      // When: WysiwygArea 생성
      // Then: 오류 없이 생성됨
      expect(() => {
        wysiwygArea = new WysiwygArea(config)
      }).not.toThrow()
    })
  })

  describe('선택 영역 작업 (getSelectedText/HTML)', () => {
    /**
     * Why: 선택된 콘텐츠를 기반으로 서식 적용이나 복사 기능을 구현해야 함
     * How: `window.getSelection()` 또는 `SelectionManager`로 선택 영역 조회
     */

    beforeEach(() => {
      const config: WysiwygAreaConfig = { container }
      wysiwygArea = new WysiwygArea(config)
    })

    it('선택된 텍스트를 가져와야 함', () => {
      // Given: 콘텐츠가 있는 WysiwygArea
      wysiwygArea.setRawContent('<p>Hello World</p>')

      // When: getSelectedText 호출
      const text = wysiwygArea.getSelectedText()

      // Then: 문자열이 반환됨
      expect(typeof text).toBe('string')
    })

    it('선택된 HTML을 가져와야 함', () => {
      // Given: 콘텐츠가 있는 WysiwygArea
      wysiwygArea.setRawContent('<p>Hello World</p>')

      // When: getSelectedHTML 호출
      const html = wysiwygArea.getSelectedHTML()

      // Then: 문자열이 반환됨
      expect(typeof html).toBe('string')
    })
  })

  describe('콘텐츠 정화 (XSS 방지)', () => {
    /**
     * Why: setContent로 유입되는 신뢰할 수 없는 HTML의 스크립트 실행을 차단
     * How: 기본 정화 활성화 시 위험 마크업 제거, sanitize:false 시 그대로 유지
     */

    it('setContent 시 기본적으로 위험한 마크업을 제거해야 함', async () => {
      // Given: 기본 설정(정화 활성화)의 WysiwygArea
      wysiwygArea = new WysiwygArea({ container })

      // When: 스크립트가 포함된 콘텐츠를 설정
      await wysiwygArea.setContent(doc(
        '<p>안전</p><script>alert(1)</script><img src="x" onerror="alert(1)">'
      ))

      // Then: script와 이벤트 핸들러가 제거됨
      const html = wysiwygArea.getElement().innerHTML
      expect(html).toContain('안전')
      expect(html).not.toContain('<script')
      expect(html).not.toContain('onerror')
    })

    it('sanitize:false 이면 정화하지 않아야 함', async () => {
      // Given: 정화를 비활성화한 WysiwygArea
      wysiwygArea = new WysiwygArea({ container, sanitize: false })

      // When: 콘텐츠를 설정
      await wysiwygArea.setContent(doc('<p>x</p><em>기울임</em>'))

      // Then: 입력이 그대로 유지됨
      const html = wysiwygArea.getElement().innerHTML
      expect(html).toContain('<em>기울임</em>')
    })
  })
})
