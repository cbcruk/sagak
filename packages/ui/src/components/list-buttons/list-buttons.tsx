import {
  useState,
  useEffect,
  useCallback,
  useId,
  type ReactNode,
} from 'preact/compat'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'kinu'
import { ListOrdered, List, ChevronDown } from 'lucide-preact'
import { ParagraphEvents, CoreEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

type ListType = 'ordered' | 'unordered' | 'none'

const ICON_SIZE = 16

function getCurrentListType(): ListType {
  const selection = window.getSelection()
  if (!selection || !selection.anchorNode) return 'none'

  let node: Node | null = selection.anchorNode

  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = (node as Element).tagName
      if (tagName === 'OL') return 'ordered'
      if (tagName === 'UL') return 'unordered'
    }
    node = node.parentNode
  }

  return 'none'
}

export function ListButtons(): ReactNode {
  const context = useEditorContext()
  const { eventBus } = context
  const [currentList, setCurrentList] = useState<ListType>('none')
  // kinu 의 DropdownMenuContent 는 ref 를 DOM 으로 넘기지 않습니다 (link-dialog 참고)
  const menuId = useId()

  const isSelectionInEditor = useCallback((): boolean => {
    const element = context.element
    if (!element) return false

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const anchorNode = selection.anchorNode
    if (!anchorNode) return false

    return element.contains(anchorNode)
  }, [context.element])

  const updateListState = useCallback((): void => {
    if (!isSelectionInEditor()) return
    setCurrentList(getCurrentListType())
  }, [isSelectionInEditor])

  useEffect(() => {
    document.addEventListener('selectionchange', updateListState)
    const unsubStyle = eventBus.on(
      CoreEvents.STYLE_CHANGED,
      'after',
      updateListState
    )
    const unsubRestore = eventBus.on(
      CoreEvents.CONTENT_RESTORED,
      'after',
      updateListState
    )

    return () => {
      document.removeEventListener('selectionchange', updateListState)
      unsubStyle()
      unsubRestore()
    }
  }, [eventBus, updateListState])

  /** 항목을 눌러도 메뉴는 스스로 닫히지 않습니다 (export-menu 와 동일) */
  const closeThen = (emit: () => void): void => {
    const menu = document.getElementById(menuId)
    if (menu instanceof HTMLDialogElement) {
      menu.close()
    }
    emit()
  }

  const CurrentIcon = currentList === 'ordered' ? ListOrdered : List

  return (
    <DropdownMenu id={menuId}>
      <DropdownMenuTrigger>
        <ToolbarButton
          title="List"
          wide
          state={currentList !== 'none' ? 'on' : undefined}
        >
          <CurrentIcon size={ICON_SIZE} aria-hidden="true" />
          <ChevronDown size={12} aria-hidden="true" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent id={menuId} aria-label="List type">
        <DropdownMenuItem
          selected={currentList === 'unordered'}
          onClick={() =>
            closeThen(() =>
              eventBus.emit(ParagraphEvents.UNORDERED_LIST_CLICKED)
            )
          }
        >
          Bullet List
        </DropdownMenuItem>
        <DropdownMenuItem
          selected={currentList === 'ordered'}
          onClick={() =>
            closeThen(() => eventBus.emit(ParagraphEvents.ORDERED_LIST_CLICKED))
          }
        >
          Numbered List
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
