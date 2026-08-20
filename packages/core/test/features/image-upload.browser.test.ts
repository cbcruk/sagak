import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  imageUpload,
  createImageUploadPlugin,
  MAX_IMAGE_SIZE,
} from '@/features/image-upload'
import { mountPluginArea } from '../helpers/plugin-area'
import type { PluginArea } from '../helpers/plugin-area'

/**
 * 이미지 업로드 — **여기 검사가 생긴 것 자체가 이번 변화입니다.**
 *
 * 이 갈래는 그동안 검사가 없었습니다. 코어 쪽은 `IMAGE_UPLOAD_FROM_FILE`
 * 이벤트 뒤에 있어서 검사가 버스를 통해 들어가야 했고, UI 쪽 사본은 `FileReader`
 * 와 `DataTransfer` 를 흉내 내야 했습니다 — 그렇게 만든 검사는 브라우저가
 * 아니라 흉내를 검사하게 됩니다.
 *
 * `read(file)` 는 파일을 받아 결과를 돌려주는 함수라 **진짜 `File` 을 만들어
 * 부르면 끝입니다.** 브라우저에서 도는 검사이므로 `FileReader` 도 진짜입니다.
 */
describe('이미지 업로드', () => {
  let ed: PluginArea

  beforeEach(() => {
    ed = mountPluginArea('<p>글</p>')
  })

  afterEach(() => {
    ed.destroy()
  })

  const png = (name = 'a.png', size = 8): File =>
    new File([new Uint8Array(size)], name, { type: 'image/png' })

  const upload = () => imageUpload(ed.context)

  describe('읽기', () => {
    it('base64 로 읽어야 함', async () => {
      const result = await upload().read(png())

      expect(result.ok).toBe(true)
      expect(result).toMatchObject({ name: 'a.png' })
      expect(result.ok && result.url).toMatch(/^data:image\/png;base64,/)
    })

    /**
     * 형식·크기가 안 맞는 것은 **예외가 아니라 답**입니다. 부르는 쪽이 그
     * 문구를 그대로 화면에 씁니다.
     */
    it('형식이 안 맞으면 문구를 돌려줘야 함', async () => {
      const result = await upload().read(
        new File(['x'], 'a.txt', { type: 'text/plain' })
      )

      expect(result).toEqual({
        ok: false,
        message:
          'Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.',
      })
    })

    it('너무 크면 문구를 돌려줘야 함', async () => {
      const result = await upload().read(png('big.png', MAX_IMAGE_SIZE + 1))

      expect(result).toEqual({
        ok: false,
        message: 'File size exceeds 5MB limit.',
      })
    })
  })

  describe('넣기', () => {
    it('문서에 이미지를 넣어야 함', async () => {
      expect(await upload().insert(png('사진.png'))).toBe(true)

      const img = ed.element.querySelector('img')
      expect(img).not.toBeNull()
      expect(img!.getAttribute('src')).toMatch(/^data:image\/png;base64,/)
      expect(img!.getAttribute('alt')).toBe('사진.png')
    })

    it('못 읽으면 문서를 안 건드려야 함', async () => {
      const before = ed.element.innerHTML

      expect(
        await upload().insert(new File(['x'], 'a.txt', { type: 'text/plain' }))
      ).toBe(false)
      expect(ed.element.innerHTML).toBe(before)
    })

    /**
     * 문서를 고치는 길이므로 조합 가드를 지납니다 (`runModelCommand`).
     */
    it('조합 중에는 안 넣어야 함', async () => {
      ed.element.dispatchEvent(new CompositionEvent('compositionstart'))

      expect(await upload().insert(png())).toBe(false)
      expect(ed.element.querySelector('img')).toBeNull()

      ed.element.dispatchEvent(new CompositionEvent('compositionend'))
    })
  })

  describe('옵션', () => {
    /**
     * **다이얼로그에서 고른 파일도 `onUpload` 를 지납니다.**
     *
     * 예전에는 끌어다 놓기만 그랬습니다 — 다이얼로그는 코어를 안 지나고 제
     * 손으로 base64 를 만들었으므로, 서버로 올리라고 설정해도 그 갈래만
     * 데이터 URL 이 문서에 박혔습니다.
     */
    it('onUpload 를 주면 그쪽 URL 을 써야 함', async () => {
      const seen: string[] = []

      await ed.pluginManager.register(
        createImageUploadPlugin({
          onUpload: async (file) => {
            seen.push(file.name)

            return `https://cdn.example.com/${file.name}`
          },
        })
      )

      const result = await upload().read(png('b.png'))

      expect(seen).toEqual(['b.png'])
      expect(result).toEqual({
        ok: true,
        url: 'https://cdn.example.com/b.png',
        name: 'b.png',
      })
    })

    it('상한을 좁히면 그것을 따라야 함', async () => {
      await ed.pluginManager.register(
        createImageUploadPlugin({ maxFileSize: 4 })
      )

      const result = await upload().read(png('a.png', 8))

      expect(result.ok).toBe(false)
    })

    /**
     * 알림 이벤트 셋을 지운 자리입니다 — 같은 것을 알리는 콜백이 원래부터
     * 있었고, 이벤트 쪽은 아무도 안 듣고 있었습니다.
     */
    it('시작·완료 콜백이 불려야 함', async () => {
      const calls: string[] = []

      await ed.pluginManager.register(
        createImageUploadPlugin({
          onUploadStart: (file) => calls.push(`start:${file.name}`),
          onUploadComplete: () => calls.push('complete'),
          onUploadError: (error) => calls.push(`error:${error.message}`),
        })
      )

      await upload().read(png('c.png'))
      expect(calls).toEqual(['start:c.png', 'complete'])

      await upload().read(new File(['x'], 'a.txt', { type: 'text/plain' }))
      expect(calls[2]).toMatch(/^error:Invalid file type/)
    })
  })

  it('같은 에디터에서는 같은 객체여야 함', () => {
    expect(imageUpload(ed.context)).toBe(upload())
  })
})
