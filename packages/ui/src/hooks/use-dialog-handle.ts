import { useId } from 'preact/hooks'
import { useEditorContext } from '../context/editor-context'

/**
 * 다이얼로그/메뉴를 코드에서 닫고, 선택 영역을 되살립니다.
 *
 * kinu 의 `Dialog.Content` 와 `DropdownMenuContent` 는 함수 컴포넌트라 `ref` 가
 * DOM 으로 전달되지 않습니다. 그래서 명시적 id 를 붙이고 그 id 로 `<dialog>`
 * 핸들을 얻는 우회가 필요한데, 이 저장소에서는 그 우회가 **여섯 곳**에 손으로
 * 복사돼 있었습니다 (`link` / `image` / `table` / `special-character` /
 * `export-menu` / `list-buttons`). `list-buttons` 와 `table-dialog` 는 아예
 * `closeThen` 이라는 같은 이름의 헬퍼를 각자 만들어 뒀고, 내용은 서로 달랐습니다.
 *
 * ## 왜 `close` 와 `restoreThen` 이 나뉘어 있는가
 *
 * 툴바에서 다이얼로그를 열면 편집 영역이 포커스를 잃고 선택 영역이 사라집니다.
 * 그래서 열기 전에 `save()`, 닫은 뒤에 복원하는 짝이 필요합니다. 복원은 다음
 * 프레임이어야 합니다 — `<dialog>` 가 닫히면서 포커스를 돌려주는 것이 먼저입니다.
 *
 * 반면 메뉴(`export-menu`, `list-buttons`)는 선택 영역을 건드리지 않으므로 닫고
 * 바로 보냅니다. 둘을 하나로 합치면 메뉴 쪽에 없던 rAF 한 프레임과 복원이
 * 끼어들어 동작이 바뀝니다. 그래서 `close()` 를 따로 남겨 둡니다.
 *
 * ## 왜 `action` 을 콜백으로 받는가
 *
 * `emit` 을 감싸지 않고 콜백으로 받아야 이벤트 페이로드 타입이 살아 있습니다.
 */
export interface DialogHandle {
  /** `Dialog` 와 `Dialog.Content` 양쪽에 넘길 id */
  id: string
  /** 열리기 직전에 부릅니다 — `restoreThen` 이 되살릴 선택 영역을 저장합니다 */
  save: () => void
  /** 닫기만 합니다 */
  close: () => void
  /** 닫고, 다음 프레임에 선택 영역을 되살린 뒤 실행합니다 */
  restoreThen: (action: () => void) => void
}

export function useDialogHandle(): DialogHandle {
  const { selectionManager } = useEditorContext()
  const id = useId()

  const close = (): void => {
    const dialog = document.getElementById(id)
    if (dialog instanceof HTMLDialogElement) {
      dialog.close()
    }
  }

  return {
    id,
    save: () => selectionManager?.saveSelection(),
    close,
    restoreThen: (action) => {
      close()
      requestAnimationFrame(() => {
        selectionManager?.restoreSelection()
        action()
      })
    },
  }
}
