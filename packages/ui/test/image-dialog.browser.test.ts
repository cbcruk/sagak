import { describe, it, expect, afterEach } from 'vitest'
import {
  mountEditor,
  placeCaretInText,
  settle,
  button,
  click,
  dialog,
  isOpen,
  fillInput,
  type MountedEditor,
} from './harness'

/**
 * 이미지 다이얼로그의 **특성 테스트** — 옮기기 전에 지금 동작을 못 박습니다.
 *
 * 색 고르개·더보기 메뉴와 같은 순서입니다. 이 컴포넌트에는 검사가 하나도
 * 없는데 **가장 큽니다**(381줄, 상태 9개). 검사 없이 옮기면 관문이 눈이 멉니다.
 *
 * ## 못 박는 것과 안 박는 것
 *
 * 넣기·고치기·지우기, 넣을 수 있을 때만 버튼이 눌리는 것, 고칠 때 기존 값이
 * 미리 채워지는 것 — **사용자가 보는 것**만 봅니다.
 *
 * 파일 업로드 갈래(드래그·미리보기·파일 형식/크기 검사)는 **여기서 안
 * 다룹니다.** `FileReader` 와 `DataTransfer` 를 흉내 내야 하는데, 그렇게 만든
 * 검사는 실제 브라우저 동작이 아니라 제 흉내를 검사하게 됩니다. 옮길 때
 * 그 갈래는 **코드를 그대로 옮기고** 대조군으로만 확인합니다 — 여기 적어
 * 두는 이유는 나중에 "왜 이건 안 봤나" 를 다시 묻지 않기 위해서입니다.
 */

let ed: MountedEditor | null = null

afterEach(() => {
  ed?.unmount()
  ed = null
})

const trigger = (): HTMLElement => button(ed!.root, 'Insert Image')
const dlg = (): HTMLDialogElement => dialog('Insert Image')

function field(labelText: string): HTMLInputElement {
  const labels = [...dlg().querySelectorAll('label')]
  const found = labels.find((el) => el.textContent?.includes(labelText))
  expect(found, `"${labelText}" 라벨을 찾지 못했습니다`).toBeDefined()

  /* kinu Label 은 for 를 안 걸므로 다음 입력칸을 씁니다 */
  const input = found!.parentElement?.querySelector('input')
  expect(input, `"${labelText}" 입력칸을 찾지 못했습니다`).not.toBeNull()
  return input as HTMLInputElement
}

function action(text: string): HTMLButtonElement {
  const found = [...dlg().querySelectorAll('button')].find(
    (el) => el.textContent?.trim() === text
  )
  expect(found, `"${text}" 버튼을 찾지 못했습니다`).toBeDefined()
  return found as HTMLButtonElement
}

async function open(): Promise<void> {
  await click(trigger())
  expect(isOpen(dlg()), '다이얼로그가 안 열렸습니다').toBe(true)
}

describe('이미지 다이얼로그', () => {
  it('열리고 닫힙니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()

    await open()
    await click(action('Cancel'))

    expect(isOpen(dlg()), '취소했는데 안 닫힙니다').toBe(false)
  })

  it('URL 이 비어 있으면 넣기가 안 눌립니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()
    await open()

    expect(action('Insert').disabled, '빈 URL 인데 눌립니다').toBe(true)

    await fillInput(field('Image URL'), 'https://example.com/a.png')

    expect(action('Insert').disabled, 'URL 을 넣었는데 안 눌립니다').toBe(false)
  })

  it('URL 로 이미지를 넣습니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()
    placeCaretInText(ed.editable, 5)
    await settle()

    await open()
    await fillInput(field('Image URL'), 'https://example.com/a.png')
    await fillInput(field('Alt Text'), '그림')
    await click(action('Insert'))
    await settle(6)

    const img = ed.editable.querySelector('img')
    expect(img, '이미지가 안 들어갔습니다').not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://example.com/a.png')
    expect(img?.getAttribute('alt')).toBe('그림')
  })

  it('크기를 주면 그대로 붙습니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()
    placeCaretInText(ed.editable, 5)
    await settle()

    await open()
    await fillInput(field('Image URL'), 'https://example.com/a.png')
    await fillInput(field('Width'), '200px')
    await click(action('Insert'))
    await settle(6)

    const img = ed.editable.querySelector('img')
    expect(img?.style.width, '너비가 안 붙었습니다').toBe('200px')
  })

  /**
   * ## 못 박지 못한 것 — 이미지를 고른 뒤의 미리 채우기
   *
   * 이미지 뒤에 캐럿을 두고(`P` offset 1) 버튼을 누르면, **누르는 순간 선택이
   * offset 0 으로 무너집니다.** 추적해서 확인했습니다:
   *
   * ```
   * 설정 뒤   anchorNode: P  offset 1
   * click 뒤  anchorNode: P  offset 0
   * ```
   *
   * `getSelectedImage()` 는 "커서 **앞의** 자식" 을 보므로 offset 0 이면
   * 못 찾고, 그래서 URL 이 안 채워집니다.
   *
   * 이게 제 재현이 실제 클릭과 달라서인지, 아니면 실제로도 이미지를 고른 뒤
   * 다이얼로그를 열면 미리 채우기가 안 되는 것인지 **가리지 못했습니다.**
   * (텍스트 캐럿은 같은 경로에서 살아남습니다 — 링크 다이얼로그가 그렇습니다.)
   *
   * 검사로 못 박지 않은 이유는, 지금 통과시키려면 `getSelectedImage` 가 안
   * 보는 방식으로 선택을 만들어야 하는데 그러면 **제 흉내를 검사하게** 되기
   * 때문입니다. 옮길 때는 이 로직을 **그대로** 옮기고, 실제 마우스로 확인할
   * 수 있는 자리에서 다시 봐야 합니다.
   */

  it('이미지를 고를 때만 지우기가 나옵니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()
    await open()

    const hasDelete = [...dlg().querySelectorAll('button')].some((el) =>
      el.textContent?.includes('Delete')
    )
    expect(hasDelete, '이미지가 없는데 지우기가 있습니다').toBe(false)
  })

  it('URL 이 비어 있으면 넣기 대신 닫기만 합니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()
    await open()

    /* 버튼이 막혀 있으므로 사용자는 취소로 나갑니다 — 글은 그대로여야 합니다 */
    await click(action('Cancel'))

    expect(isOpen(dlg())).toBe(false)
    expect(ed.editable.querySelector('img')).toBeNull()
  })

  /**
   * ## 상한을 넘으면 **누르기 전에** 말해 줍니다
   *
   * 모델이 상한 넘는 값을 안 받습니다 (`insertImage`). 그런데 적용은 닫은 다음
   * 프레임이라, 그냥 두면 **다이얼로그가 닫히고 아무 일도 안 일어납니다** —
   * 예전 플러그인이 그랬고 그래서 §11-2 에서 "UX 가드" 라며 비워 뒀던 것입니다.
   */
  it('크기가 상한을 넘으면 넣기가 막히고 이유가 보입니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()
    await open()

    await fillInput(field('Image URL'), 'https://example.com/a.png')
    await fillInput(field('Width'), '5000px')
    await settle(2)

    const alert = dlg().querySelector('[role="alert"]')
    expect(alert?.textContent, '이유가 안 보입니다').toContain('1920px')
    expect(action('Insert').disabled, '거절될 값인데 누를 수 있습니다').toBe(
      true
    )

    /* 상한 안으로 고치면 다시 열립니다 */
    await fillInput(field('Width'), '800px')
    await settle(2)

    expect(dlg().querySelector('[role="alert"]')).toBeNull()
    expect(action('Insert').disabled).toBe(false)
  })

  it('퍼센트는 상한과 무관합니다', async () => {
    ed = await mountEditor('<p>hello</p>')
    await settle()
    await open()

    await fillInput(field('Image URL'), 'https://example.com/a.png')
    await fillInput(field('Width'), '100%')
    await settle(2)

    expect(dlg().querySelector('[role="alert"]')).toBeNull()
    expect(action('Insert').disabled).toBe(false)
  })
})
