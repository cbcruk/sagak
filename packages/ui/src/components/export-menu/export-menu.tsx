import { useId, type ReactNode } from 'preact/compat'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'kinu'
import { Download, FileText, FileCode, FileType } from 'lucide-preact'
import { ExportEvents, type ExportFormat } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const ICON_SIZE = 18

interface ExportOption {
  format: ExportFormat
  label: string
  icon: ReactNode
  description: string
}

const exportOptions: ExportOption[] = [
  {
    format: 'html',
    label: 'HTML',
    icon: <FileCode size={16} />,
    description: 'Web page format',
  },
  {
    format: 'markdown',
    label: 'Markdown',
    icon: <FileType size={16} />,
    description: 'Plain text with formatting',
  },
  {
    format: 'text',
    label: 'Plain Text',
    icon: <FileText size={16} />,
    description: 'No formatting',
  },
]

const triggerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 26,
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  background: '#fff',
  color: '#333',
  cursor: 'pointer',
}

export interface ExportMenuProps {
  filename?: string
}

export function ExportMenu({
  filename = 'document',
}: ExportMenuProps): ReactNode {
  const { eventBus } = useEditorContext()
  // `DropdownMenuItem` 은 항목을 눌러도 메뉴를 닫지 않습니다.
  // `link-dialog` 와 같은 이유로 id 를 직접 잡아 `<dialog>` 를 닫습니다.
  const menuId = useId()

  const handleExport = (format: ExportFormat): void => {
    const menu = document.getElementById(menuId)
    if (menu instanceof HTMLDialogElement) {
      menu.close()
    }
    eventBus.emit(ExportEvents.EXPORT_DOWNLOAD, { format, filename })
  }

  return (
    <DropdownMenu id={menuId}>
      {/* Trigger 는 자식에 commandfor/command 를 얹을 뿐 자체 요소를 만들지 않습니다 */}
      <DropdownMenuTrigger>
        <button type="button" title="Export" style={triggerStyle}>
          <Download size={ICON_SIZE} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent id={menuId} aria-label="Export as">
        {exportOptions.map((option) => (
          <DropdownMenuItem
            key={option.format}
            onClick={() => handleExport(option.format)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {option.icon}
              <span>
                <span style={{ display: 'block' }}>{option.label}</span>
                <span style={{ display: 'block', fontSize: 11, opacity: 0.6 }}>
                  {option.description}
                </span>
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
