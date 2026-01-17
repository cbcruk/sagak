import { useState, useRef, useEffect, useCallback } from 'react'
import {
  MoreHorizontal,
  Link,
  Image,
  Table,
  Minus,
  Type,
  Search,
  Subscript,
  Superscript,
  ALargeSmall,
  CaseSensitive,
} from 'lucide-react'
import { useEditorContext } from '../../context/editor-context'
import { ContentEvents, TextStyleEvents, FindReplaceEvents } from 'sagak-core'

interface MoreMenuItem {
  icon: React.ReactNode
  label: string
  action: () => void
  isActive?: boolean
}

interface MoreMenuSection {
  title: string
  items: MoreMenuItem[]
}

const ICON_SIZE = 16

export function MoreMenu(): React.ReactNode {
  const context = useEditorContext()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      menuRef.current &&
      !menuRef.current.contains(event.target as Node) &&
      triggerRef.current &&
      !triggerRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, handleClickOutside])

  const handleAction = useCallback(
    (action: () => void) => {
      action()
      setIsOpen(false)
    },
    []
  )

  const sections: MoreMenuSection[] = [
    {
      title: 'Insert',
      items: [
        {
          icon: <Link size={ICON_SIZE} />,
          label: 'Link',
          action: () => {
            // Link dialog will be triggered separately
          },
        },
        {
          icon: <Image size={ICON_SIZE} />,
          label: 'Image',
          action: () => {
            // Image dialog will be triggered separately
          },
        },
        {
          icon: <Table size={ICON_SIZE} />,
          label: 'Table',
          action: () => {
            // Table dialog will be triggered separately
          },
        },
        {
          icon: <Minus size={ICON_SIZE} />,
          label: 'Horizontal Rule',
          action: () => {
            context?.eventBus?.emit(ContentEvents.HORIZONTAL_RULE_INSERT)
          },
        },
        {
          icon: <Type size={ICON_SIZE} />,
          label: 'Special Character',
          action: () => {
            // Special character dialog will be triggered separately
          },
        },
      ],
    },
    {
      title: 'Text Style',
      items: [
        {
          icon: <Subscript size={ICON_SIZE} />,
          label: 'Subscript',
          action: () => {
            context?.eventBus?.emit(TextStyleEvents.TOGGLE_SUBSCRIPT)
          },
        },
        {
          icon: <Superscript size={ICON_SIZE} />,
          label: 'Superscript',
          action: () => {
            context?.eventBus?.emit(TextStyleEvents.TOGGLE_SUPERSCRIPT)
          },
        },
      ],
    },
    {
      title: 'Format',
      items: [
        {
          icon: <ALargeSmall size={ICON_SIZE} />,
          label: 'Line Height',
          action: () => {
            // Line height select will be in main toolbar
          },
        },
        {
          icon: <CaseSensitive size={ICON_SIZE} />,
          label: 'Letter Spacing',
          action: () => {
            // Letter spacing select will be in main toolbar
          },
        },
      ],
    },
    {
      title: 'Tools',
      items: [
        {
          icon: <Search size={ICON_SIZE} />,
          label: 'Find & Replace',
          action: () => {
            context?.eventBus?.emit(FindReplaceEvents.FIND)
          },
        },
      ],
    },
  ]

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        data-scope="more-menu"
        data-part="trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="More options"
      >
        <MoreHorizontal size={ICON_SIZE} />
      </button>

      {isOpen && (
        <div ref={menuRef} data-scope="more-menu" data-part="menu">
          {sections.map((section) => (
            <div key={section.title} data-scope="more-menu" data-part="section">
              <div data-scope="more-menu" data-part="section-title">
                {section.title}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  data-scope="more-menu"
                  data-part="item"
                  data-state-active={item.isActive ? '' : undefined}
                  onClick={() => handleAction(item.action)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
