import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { trackComposition } from '@/core/composition'
import type { CompositionTracker } from '@/core/composition'
import { PluginManager } from '@/core/plugin-manager'
import { createImagePlugin, ImagePlugin } from '@/plugins/image-plugin'
import { WysiwygArea } from '@/editor/editing-area/modes/wysiwyg-area'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import type { EditorContext, EditingAreaManager } from '@/core/types'
import type { ImageData } from '@/plugins/image-plugin'

/**
 * 이미지도 **문서 모델 위에서** 다룹니다.
 *
 * 예전에는 `document.createElement('img')` 를 만들어 선택 자리에 꽂고, 고칠
 * 때는 DOM 선택에서 `<img>` 를 거슬러 찾았습니다. 이제 넣는 것은 트랜잭션이고
 * 찾는 것은 `NodeSelection` 이나 캐럿 옆의 노드입니다.
 *
 * **테두리만 안 붙습니다.** 생김새는 스타일시트의 몫입니다. 정렬은 문단의
 * 정렬과 같은 자리라 모델이 압니다 (`docs/prosemirror-migration.md` §10).
 */
describe('ImagePlugin', () => {
  let eventBus: EventBus
  let pluginManager: PluginManager
  let composition: CompositionTracker
  let container: HTMLDivElement
  let area: WysiwygArea
  let element: HTMLElement
  let context: EditorContext

  /** 문서의 첫 이미지를 통째로 고릅니다 */
  const selectImage = (): void => {
    const handle = area.getStateHandle()
    const state = handle.getState()!
    let at = -1

    state.doc.descendants((node, pos) => {
      if (at < 0 && node.type.name === 'image') at = pos
      return at < 0
    })

    if (at < 0) return

    handle.dispatch(
      state.tr.setSelection(NodeSelection.create(state.doc, at))
    )
  }

  /**
   * 글 끝에 캐럿을 둡니다 — 이미지가 안 골린 상태.
   *
   * 문서 맨 앞은 안 됩니다. 이미지가 문단 처음에 들어가 있어 그 자리는
   * "캐럿 바로 뒤가 이미지" 라 골린 것으로 칩니다.
   */
  const selectText = (): void => {
    const handle = area.getStateHandle()
    const state = handle.getState()!

    handle.dispatch(
      state.tr.setSelection(
        TextSelection.create(state.doc, state.doc.content.size - 1)
      )
    )
  }

  const image = (): HTMLImageElement | null =>
    element.querySelector('img')

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)

    eventBus = new EventBus()
    area = new WysiwygArea({ container, eventBus })
    area.setRawContent('<p>Hello World</p>')
    element = area.getElement()
    composition = trackComposition(element)

    context = {
      eventBus,
      composition,
      config: {},
      editingAreaManager: {
        getCurrentArea: () => area,
      } as unknown as EditingAreaManager,
    }
    pluginManager = new PluginManager(context)
  })

  afterEach(() => {
    area.destroy()
    document.body.removeChild(container)
  })

  describe('플러그인 등록 (기본 초기화)', () => {
    /**
     * Why: ImagePlugin이 올바르게 등록되고 초기화되는지 확인
     * How: `PluginManager`에 플러그인을 등록하고 존재 여부를 검증
     */

    it('ImagePlugin', async () => {
      // Given: PluginManager 준비됨

      // When: ImagePlugin을 등록
      await pluginManager.register(ImagePlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('content:image')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션 준비
      const customPlugin = createImagePlugin({
        maxWidth: 800,
        maxHeight: 600,
        defaultWidth: '400px',
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 플러그인이 등록되어야 함
      expect(pluginManager.has('content:image')).toBe(true)
    })
  })

  describe('Image insertion', () => {
    /**
     * Why: 사용자가 에디터에 이미지를 삽입할 수 있어야 함
     * How: `IMAGE_INSERT` 이벤트 발행 시 DOM에 `<img>` 요소를 생성하고
     *      `STYLE_CHANGED` 이벤트를 발행
     */

    beforeEach(async () => {
      // Given: ImagePlugin 등록됨
      await pluginManager.register(ImagePlugin)
    })

    it('should insert image with URL', () => {
      // Given: 이벤트 리스너 준비
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      const imageData: ImageData = {
        src: 'https://example.com/image.jpg',
        alt: 'Test image',
      }

      // When: IMAGE_INSERT 이벤트 발행
      const result = eventBus.emit('IMAGE_INSERT', imageData)

      // Then: 이미지가 삽입되고 이벤트가 발행되어야 함
      expect(result).toBe(true)
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'image',
        action: 'insert',
        src: 'https://example.com/image.jpg',
      })

      const img = element.querySelector('img')
      expect(img).toBeTruthy()
      expect(img?.src).toBe('https://example.com/image.jpg')
      expect(img?.alt).toBe('Test image')

      vi.restoreAllMocks()
    })

    it('should insert image with data URL', () => {
      // Given: data URL 이미지 데이터 준비
      const imageData: ImageData = {
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        alt: 'Test data image',
      }

      // When: IMAGE_INSERT 이벤트 발행
      const result = eventBus.emit('IMAGE_INSERT', imageData)

      // Then: data URL 이미지가 삽입되어야 함
      expect(result).toBe(true)

      const img = element.querySelector('img')
      expect(img).toBeTruthy()
      expect(img?.src).toContain('data:image/png;base64,')
    })

    it('should insert image with dimensions', () => {
      // Given: 크기가 지정된 이미지 데이터 준비
      const imageData: ImageData = {
        src: 'https://example.com/image.jpg',
        width: '300px',
        height: '200px',
      }

      // When: IMAGE_INSERT 이벤트 발행
      eventBus.emit('IMAGE_INSERT', imageData)

      // Then: 이미지 크기가 적용되어야 함
      const img = element.querySelector('img')
      expect(img?.style.width).toBe('300px')
      expect(img?.style.height).toBe('200px')
    })

    /**
     * Why: 정렬은 **글이 어디에 놓이는가**라 문서의 뜻입니다 — 문단의 정렬과
     *      같은 자리이므로 모델이 압니다.
     * How: 인라인 요소라 `text-align` 이 안 통해서 블록으로 만들고 좌우 여백을
     *      `auto` 로 밉니다. 예전 `applyImageAlignment` 과 같은 꼴이라 그때
     *      만들어진 문서도 그대로 읽힙니다.
     */
    it('정렬은 문서에 붙습니다', () => {
      eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
        alignment: 'center',
      })

      const img = image()
      expect(img?.style.display).toBe('block')
      expect(img?.style.marginLeft).toBe('auto')
      expect(img?.style.marginRight).toBe('auto')
    })

    /**
     * Why: 테두리는 **생김새**라 스타일시트의 몫입니다.
     * How: 스키마에 자리가 없어 넘겨도 안 붙습니다.
     */
    it('테두리는 문서에 안 붙습니다', () => {
      eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
        border: '2px solid red',
      })

      expect(image()?.style.border).toBe('')
    })

    it('should reject image without src', () => {
      // Given: console.warn spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: src 없이 IMAGE_INSERT 이벤트 발행
      const result = eventBus.emit('IMAGE_INSERT', { alt: 'No src' } as any)

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Image insert blocked: No src provided'
      )

      consoleWarn.mockRestore()
    })

    it('should reject image with invalid URL', () => {
      // Given: console.warn spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 위험한 URL로 IMAGE_INSERT 이벤트 발행
      const result = eventBus.emit('IMAGE_INSERT', {
        src: 'javascript:alert("xss")',
      })

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Image insert blocked: Invalid image URL "javascript:alert("xss")"'
      )

      consoleWarn.mockRestore()
    })

    it('should reject image with invalid data URL', () => {
      // Given: console.warn spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 이미지가 아닌 data URL로 IMAGE_INSERT 이벤트 발행
      const result = eventBus.emit('IMAGE_INSERT', {
        src: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgneHNzJyk8L3NjcmlwdD4=',
      })

      // Then: 차단되어야 함
      expect(result).toBe(false)

      consoleWarn.mockRestore()
    })

    it('should reject image with width exceeding maximum', () => {
      // Given: console.warn spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 최대 너비를 초과하는 이미지로 이벤트 발행
      const result = eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
        width: '5000px',
      })

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Image insert blocked: width 5000px exceeds maximum 1920px'
      )

      consoleWarn.mockRestore()
    })

    it('should reject image with height exceeding maximum', () => {
      // Given: console.warn spy 준비
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // When: 최대 높이를 초과하는 이미지로 이벤트 발행
      const result = eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
        height: '3000px',
      })

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Image insert blocked: height 3000px exceeds maximum 1080px'
      )

      consoleWarn.mockRestore()
    })
  })

  describe('Image update', () => {
    /**
     * Why: 사용자가 삽입된 이미지의 속성을 수정할 수 있어야 함
     * How: 이미지를 선택한 상태에서 `IMAGE_UPDATE` 이벤트 발행 시
     *      선택된 `<img>` 요소의 속성을 변경
     */

    beforeEach(async () => {
      // Given: ImagePlugin 등록되고 이미지 삽입됨
      await pluginManager.register(ImagePlugin)

      eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
        width: '300px',
        height: '200px',
        alt: 'Original',
      })
    })

    it('should update image width', () => {
      // Given: 이미지 선택
      selectImage()

      // When: IMAGE_UPDATE 이벤트 발행
      const result = eventBus.emit('IMAGE_UPDATE', { width: '500px' })

      // Then: 이미지 너비가 업데이트되어야 함
      expect(result).toBe(true)
      expect(image()?.style.width).toBe('500px')
    })

    it('should update image alt text', () => {
      // Given: 이미지 선택
      selectImage()

      // When: IMAGE_UPDATE 이벤트 발행
      eventBus.emit('IMAGE_UPDATE', { alt: 'Updated alt' })

      // Then: 이미지 alt가 업데이트되어야 함
      expect(image()?.alt).toBe('Updated alt')
    })

    it('정렬을 고칠 수 있습니다', () => {
      // Given: 이미지 선택
      selectImage()

      // When: IMAGE_UPDATE 이벤트 발행
      eventBus.emit('IMAGE_UPDATE', { alignment: 'center' })

      // Then: 가운데 정렬이 붙습니다
      expect(image()?.style.display).toBe('block')
      expect(image()?.style.marginLeft).toBe('auto')
      expect(image()?.style.marginRight).toBe('auto')
    })

    it('should fail when no image is selected', () => {
      // Given: console.warn spy 준비, 텍스트 선택
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      selectText()

      // When: IMAGE_UPDATE 이벤트 발행
      const result = eventBus.emit('IMAGE_UPDATE', { width: '400px' })

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Image update blocked: No image selected'
      )

      consoleWarn.mockRestore()
    })

    it('should emit STYLE_CHANGED after update', () => {
      // Given: 이미지 선택, 이벤트 리스너 준비
      selectImage()

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: IMAGE_UPDATE 이벤트 발행
      eventBus.emit('IMAGE_UPDATE', { width: '400px' })

      // Then: STYLE_CHANGED 이벤트가 발행되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'image',
        action: 'update',
      })

      vi.restoreAllMocks()
    })
  })

  describe('Image deletion', () => {
    /**
     * Why: 사용자가 삽입된 이미지를 삭제할 수 있어야 함
     * How: 이미지를 선택한 상태에서 `IMAGE_DELETE` 이벤트 발행 시
     *      선택된 `<img>` 요소를 DOM에서 제거
     */

    beforeEach(async () => {
      // Given: ImagePlugin 등록되고 이미지 삽입됨
      await pluginManager.register(ImagePlugin)

      eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
      })
    })

    it('should delete selected image', () => {
      // Given: 이미지 존재 확인 및 선택
      let img = element.querySelector('img')
      expect(img).toBeTruthy()

      selectImage()

      // When: IMAGE_DELETE 이벤트 발행
      const result = eventBus.emit('IMAGE_DELETE')

      // Then: 이미지가 삭제되어야 함
      expect(result).toBe(true)

      img = element.querySelector('img')
      expect(img).toBeNull()
    })

    it('should emit STYLE_CHANGED after deletion', () => {
      // Given: 이미지 선택, 이벤트 리스너 준비
      selectImage()

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: IMAGE_DELETE 이벤트 발행
      eventBus.emit('IMAGE_DELETE')

      // Then: STYLE_CHANGED 이벤트가 발행되어야 함
      expect(styleChangedSpy).toHaveBeenCalledWith({
        style: 'image',
        action: 'delete',
      })

      vi.restoreAllMocks()
    })

    it('should fail when no image is selected', () => {
      // Given: console.warn spy 준비, 텍스트 선택
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      selectText()

      // When: IMAGE_DELETE 이벤트 발행
      const result = eventBus.emit('IMAGE_DELETE')

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Image delete blocked: No image selected'
      )

      consoleWarn.mockRestore()
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: 한글, 일본어 등 조합 문자 입력 중 이미지 조작을 방지해야 함
     * How: `CompositionTracker.isComposing()`으로 조합 상태를 확인하고 차단
     */

    beforeEach(async () => {
      // Given: ImagePlugin 등록됨
      await pluginManager.register(ImagePlugin)
    })

    it('should block image insertion during IME composition', () => {
      // Given: console.warn spy 준비, IME 조합 시작
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(composition.isComposing()).toBe(true)

      // When: 조합 중 IMAGE_INSERT 이벤트 발행
      const result = eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
      })

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('IME composition in progress')
      )

      consoleWarn.mockRestore()
    })

    it('should block image update during IME composition', () => {
      // Given: 이미지 삽입, 선택, IME 조합 시작
      eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
      })

      selectImage()

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // When: 조합 중 IMAGE_UPDATE 이벤트 발행
      const result = eventBus.emit('IMAGE_UPDATE', { width: '400px' })

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('IME composition in progress')
      )

      consoleWarn.mockRestore()
    })

    it('should block image deletion during IME composition', () => {
      // Given: 이미지 삽입, 선택, IME 조합 시작
      eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
      })

      selectImage()

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // When: 조합 중 IMAGE_DELETE 이벤트 발행
      const result = eventBus.emit('IMAGE_DELETE')

      // Then: 차단되고 경고가 출력되어야 함
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('IME composition in progress')
      )

      consoleWarn.mockRestore()
    })

    it('should allow image operations after composition ends', () => {
      // Given: IME 조합 시작 후 종료
      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(composition.isComposing()).toBe(false)

      // When: 조합 종료 후 IMAGE_INSERT 이벤트 발행
      const result = eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
      })

      // Then: 정상 동작해야 함
      expect(result).toBe(true)
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인 정리 시 이벤트 핸들러가 해제되어야 함
     * How: `destroy()` 호출 후 이벤트가 처리되지 않는지 확인
     */

    it('destroy 시 정리를 수행해야 함', async () => {
      // Given: ImagePlugin 등록되고 동작 확인
      await pluginManager.register(ImagePlugin)

      let result = eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
      })
      expect(result).toBe(true)

      // When: 플러그인 정리
      pluginManager.destroyAll()

      // Then: 이벤트가 처리되지 않아야 함
      result = eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image2.jpg',
      })

      const images = element.querySelectorAll('img')
      expect(images.length).toBe(1)
    })
  })

  describe('실제 시나리오 (사용자 동작 시뮬레이션)', () => {
    /**
     * Why: 실제 사용자의 이미지 삽입/수정/삭제 워크플로우를 검증
     * How: 이미지 삽입 후 속성 변경, 여러 이미지 관리 등 다양한 시나리오를 테스트
     */

    beforeEach(async () => {
      // Given: ImagePlugin 등록됨
      await pluginManager.register(ImagePlugin)
    })

    it('should insert, update, and delete an image', () => {
      // Given: 이미지 삽입
      eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
        width: '300px',
        alt: 'Test',
      })

      expect(image()).toBeTruthy()
      expect(image()?.style.width).toBe('300px')

      // When: 이미지 선택 및 수정
      selectImage()

      eventBus.emit('IMAGE_UPDATE', { width: '500px' })

      /*
       * Then: 이미지가 수정되어야 함.
       *
       * 매번 다시 물어야 합니다 — 속성이 바뀌면 PM 이 `<img>` 를 다시 그려서
       * 예전에 잡아 둔 요소는 문서에서 떨어져 나갑니다.
       */
      expect(image()?.style.width).toBe('500px')

      // When: 이미지 삭제
      selectImage()
      eventBus.emit('IMAGE_DELETE')

      // Then: 이미지가 삭제되어야 함
      expect(image()).toBeNull()
    })

    it('should handle multiple images', () => {
      // Given: 첫 번째 이미지 삽입
      eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image1.jpg',
      })

      // When: 두 번째 이미지 삽입
      eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image2.jpg',
      })

      // Then: 두 개의 이미지가 존재해야 함
      const images = element.querySelectorAll('img')
      expect(images.length).toBe(2)
      expect(images[0]?.src).toBe('https://example.com/image1.jpg')
      expect(images[1]?.src).toBe('https://example.com/image2.jpg')
    })

    it('should insert image with all properties', () => {
      // Given: 모든 속성이 지정된 이미지 데이터 준비

      // When: IMAGE_INSERT 이벤트 발행
      eventBus.emit('IMAGE_INSERT', {
        src: 'https://example.com/image.jpg',
        width: '400px',
        height: '300px',
        alt: 'Full featured image',
        alignment: 'center',
        border: '1px solid #ccc',
      })

      // Then: 스키마가 아는 다섯이 적용되고 테두리만 빠집니다
      const img = image()
      expect(img?.src).toBe('https://example.com/image.jpg')
      expect(img?.style.width).toBe('400px')
      expect(img?.style.height).toBe('300px')
      expect(img?.alt).toBe('Full featured image')
      expect(img?.style.marginLeft).toBe('auto')
      expect(img?.style.border).toBe('')
    })
  })
})
