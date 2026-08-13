import type { EditorContext } from 'sagak-core'

/**
 * kinu 를 대신할 **원시 요소들** — 2단계의 핵심입니다.
 *
 * ## 왜 이것부터인가
 *
 * `kinu@0.1.4` 는 `peerDependencies: { preact }` 입니다. 남아 있는 한 Preact 가
 * 번들에 실리므로, **kinu 를 안 걷어내면 이주가 끝나지 않습니다.** 남은
 * 컴포넌트 11개가 전부 kinu 를 쓰고 그중 `Dialog` 만 6곳입니다.
 *
 * ## 접근성 부담이 생각보다 작습니다 (재 봤습니다)
 *
 * kinu `Dialog` 의 구현을 열어 보니 **네이티브 `<dialog>` + `showModal()`**
 * 입니다. 즉 포커스 트랩·Esc 로 닫기·백드롭·`inert` 는 전부 **브라우저가**
 * 합니다. kinu 가 얹은 것은 `commandfor`/`command` 로 여는 배선과 CSS 뿐입니다.
 *
 * 직접 만들 때 우리가 책임지는 것은 **마크업과 배선**이지 접근성 동작이
 * 아닙니다. 2단계를 시작하기 전 가장 컸던 걱정이 여기서 줄었습니다.
 *
 * ## 생김새는 `k` 속성으로 그대로 받습니다
 *
 * kinu 의 CSS 는 `[k=button]`·`[k=input]` 처럼 **속성 선택자**입니다. 네이티브
 * 요소에 같은 속성을 달면 그 스타일이 그대로 걸립니다. 옮긴 것과 안 옮긴 것이
 * 섞여 있는 동안 생김새가 갈리지 않는 것이 우선입니다.
 *
 * **이건 이주 중 다리입니다.** kinu 를 지울 때 CSS 도 같이 사라지므로, 그때
 * 쓰는 규칙만 우리 스타일시트로 옮겨야 합니다 — 전체 48KB 중 우리가 쓰는
 * 것은 약 10KB 입니다 (`button` 2.9K · `input` 2.0K · `select` 1.7K ·
 * `tab` 1.1K · `toggle` 1.0K · `checkbox` 0.9K · 나머지 0.4K).
 */

/** kinu 스타일을 받는 네이티브 요소를 만듭니다 */
function styled<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  k: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  el.setAttribute('k', k)
  return el
}

export interface ButtonOptions {
  label: string
  /** `type="button"` 이 기본입니다 — 폼 안에서 의도치 않게 제출되지 않도록 */
  variant?: string
}

export function button({ label, variant }: ButtonOptions): HTMLButtonElement {
  const el = styled('button', 'button')
  el.type = 'button'
  el.textContent = label
  if (variant) el.setAttribute('variant', variant)
  return el
}

export function input(
  attrs: Partial<
    Pick<HTMLInputElement, 'type' | 'value' | 'placeholder' | 'checked'>
  > = {}
): HTMLInputElement {
  const el = styled('input', 'input')
  if (attrs.type) el.type = attrs.type
  if (attrs.value !== undefined) el.value = attrs.value
  if (attrs.placeholder) el.placeholder = attrs.placeholder
  if (attrs.checked !== undefined) el.checked = attrs.checked
  return el
}

export function label(text: string, control?: HTMLElement): HTMLLabelElement {
  const el = styled('label', 'label')
  el.textContent = text
  if (control?.id) el.htmlFor = control.id
  return el
}

export interface DialogParts {
  /** 최상위 `<dialog>` — 열고 닫는 것은 이 요소입니다 */
  root: HTMLDialogElement
  /** 제목 아래 본문이 들어가는 자리 */
  body: HTMLDivElement
  /** 버튼들이 오른쪽으로 붙는 줄 */
  actions: HTMLDivElement
  open(): void
  close(): void
}

/**
 * 모달 다이얼로그.
 *
 * `aria-label` 을 반드시 받습니다 — 기존 테스트들이
 * `dialog[aria-label="…"]` 로 찾고, 화면 낭독기도 이 이름을 읽습니다.
 *
 * 백드롭을 누르면 닫습니다. 네이티브 `<dialog>` 는 backdrop 클릭도 `<dialog>`
 * 자신을 타깃으로 주므로, **클릭 좌표가 내용 상자 밖인지**로 가릅니다.
 */
export function dialog(ariaLabel: string): DialogParts {
  const root = document.createElement('dialog')
  /*
   * kinu 의 다이얼로그 스타일을 받습니다 — 배경·모서리·그림자·백드롭이
   * 여기서 옵니다. 이걸 안 달면 네이티브 기본 스타일이 남아 **테마를 안
   * 따라갑니다.** `theme.browser.test.tsx` 가 실제로 그 회귀를 잡았습니다.
   */
  root.setAttribute('k', 'dialog-content')
  root.setAttribute('aria-label', ariaLabel)

  const heading = document.createElement('h2')
  heading.textContent = ariaLabel

  const body = document.createElement('div')

  const actions = document.createElement('div')
  Object.assign(actions.style, {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  })

  root.append(heading, body, actions)

  root.addEventListener('click', (event) => {
    if (event.target !== root) return
    const box = root.getBoundingClientRect()
    const outside =
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    if (outside) root.close()
  })

  return {
    root,
    body,
    actions,
    open: () => root.showModal(),
    close: () => root.close(),
  }
}

/**
 * 다이얼로그가 선택 영역을 다루는 규약 — `useDialogHandle` 과 같습니다.
 *
 * 툴바를 누르면 포커스가 에디터를 떠나므로 열기 전에 저장하고, 적용은 닫은
 * **다음 프레임**에 합니다. 닫히기 전에 되돌리면 다이얼로그가 아직 포커스를
 * 쥐고 있어 선택이 다시 풀립니다.
 */
export function dialogSelection(
  editor: EditorContext,
  parts: Pick<DialogParts, 'close'>
): { save(): void; restoreThen(action: () => void): void } {
  return {
    save: () => {
      editor.selectionManager?.saveSelection()
    },
    restoreThen: (action) => {
      parts.close()
      requestAnimationFrame(() => {
        editor.selectionManager?.restoreSelection()
        action()
      })
    },
  }
}
