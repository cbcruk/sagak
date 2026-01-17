import { useState, type ReactNode } from 'react'
import { Menu } from '@base-ui/react/menu'
import { Download, FileText, FileCode, FileType } from 'lucide-react'
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

export interface ExportMenuProps {
  filename?: string
}

export function ExportMenu({ filename = 'document' }: ExportMenuProps): ReactNode {
  const { eventBus } = useEditorContext()
  const [open, setOpen] = useState(false)

  const handleExport = (format: ExportFormat): void => {
    eventBus.emit(ExportEvents.EXPORT_DOWNLOAD, {
      format,
      filename,
    })
    setOpen(false)
  }

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger
        style={{
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
        }}
        title="Export"
      >
        <Download size={ICON_SIZE} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup
            style={{
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              padding: 4,
              minWidth: 180,
              zIndex: 1000,
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                fontSize: 12,
                color: '#666',
                borderBottom: '1px solid #e5e5e5',
                marginBottom: 4,
              }}
            >
              Export as...
            </div>
            {exportOptions.map((option) => (
              <Menu.Item
                key={option.format}
                onClick={() => handleExport(option.format)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  fontSize: 14,
                  color: '#333',
                }}
                onMouseEnter={(e) => {
                  ;(e.target as HTMLElement).style.background = '#f5f5f5'
                }}
                onMouseLeave={(e) => {
                  ;(e.target as HTMLElement).style.background = 'transparent'
                }}
              >
                <span style={{ color: '#666' }}>{option.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{option.label}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {option.description}
                  </div>
                </div>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
