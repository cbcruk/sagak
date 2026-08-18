<script lang="ts">
  import { Download, FileText, FileCode, FileType } from 'lucide'
  import type { IconNode } from 'lucide'
  import { ExportEvents, type ExportFormat } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'

  /**
   * 내보내기 메뉴 — 목록 버튼에서 만든 드롭다운 얼개를 **그대로** 씁니다.
   *
   * `[k=dropdown]` 안에 `[commandfor]` 달린 트리거와 `<dialog
   * k="dropdown-content">`. 위치는 CSS 앵커가 잡고, 항목을 눌러도 메뉴는
   * 스스로 닫히지 않으니 직접 닫습니다. 두 번째로 옮기면서 확인한 것은
   * **얼개가 반복된다는 것**이지 새로운 문제가 아닙니다.
   *
   * 다른 점은 항목 안쪽이 두 줄(이름 + 설명)이라는 것뿐입니다.
   *
   * ## `filename` 은 아무도 안 넘깁니다
   *
   * Preact 판에도 있던 prop 인데 툴바가 `<ExportMenu />` 로만 씁니다. 기본값
   * `'document'` 가 그대로 나가고 있었습니다. **고치지 않고 그대로 둡니다** —
   * 파일 이름을 어디서 받아 올지는 문서 줄(`document-bar`)까지 옮긴 뒤에
   * 봐야 할 이야기입니다.
   */

  interface Props {
    editor: EditorContext
    /** 좁은 화면에서 트리거를 감춥니다 — 자세한 이유는 아래 */
    hideTrigger?: boolean
    filename?: string
  }

  const { editor, filename = 'document', hideTrigger = false }: Props =
    $props()

  const menuId = $props.id()

  let menuEl: HTMLDialogElement

  interface Option {
    format: ExportFormat
    label: string
    node: IconNode
    description: string
  }

  const OPTIONS: Option[] = [
    {
      format: 'html',
      label: 'HTML',
      node: FileCode,
      description: 'Web page format',
    },
    {
      format: 'markdown',
      label: 'Markdown',
      node: FileType,
      description: 'Plain text with formatting',
    },
    {
      format: 'text',
      label: 'Plain Text',
      node: FileText,
      description: 'No formatting',
    },
  ]

  function exportAs(format: ExportFormat): void {
    menuEl.close()
    editor.eventBus.emit(ExportEvents.EXPORT_DOWNLOAD, { format, filename })
  }
</script>

<div k="dropdown">
  <button
    type="button"
    commandfor={menuId}
    data-part="icon-button"
  data-mobile={hideTrigger ? 'hidden' : undefined}
    title="Export"
    aria-label="Export"
    onclick={() => menuEl.show()}
  >
    {@html icon(Download, 18).outerHTML}
  </button>

  <dialog bind:this={menuEl} id={menuId} k="dropdown-content" aria-label="Export as">
    {#each OPTIONS as option (option.format)}
      <button
        type="button"
        k="dropdown-menu-item"
        onclick={() => exportAs(option.format)}
      >
        <span style="display: flex; align-items: center; gap: 10px">
          {@html icon(option.node, 16).outerHTML}
          <span>
            <span style="display: block">{option.label}</span>
            <span style="display: block; font-size: 11px; opacity: 0.6">
              {option.description}
            </span>
          </span>
        </span>
      </button>
    {/each}
  </dialog>
</div>
