import { useState, type ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Omega } from 'lucide-react'
import { ContentEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const ICON_SIZE = 18

interface CharacterCategory {
  name: string
  characters: string[]
}

const categories: CharacterCategory[] = [
  {
    name: 'Arrows',
    characters: ['←', '→', '↑', '↓', '↔', '↕', '⇐', '⇒', '⇑', '⇓', '⇔', '⇕', '➜', '➔', '➝', '➞'],
  },
  {
    name: 'Math',
    characters: ['±', '×', '÷', '≠', '≈', '≤', '≥', '∞', '∑', '∏', '√', '∫', '∂', '∆', '∇', '∈', '∉', '⊂', '⊃', '∪', '∩'],
  },
  {
    name: 'Currency',
    characters: ['$', '€', '£', '¥', '₩', '¢', '₹', '₽', '฿', '₿', '₺', '₴'],
  },
  {
    name: 'Greek',
    characters: ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'],
  },
  {
    name: 'Symbols',
    characters: ['©', '®', '™', '§', '¶', '†', '‡', '•', '°', '′', '″', '‰', '№', '℃', '℉', '♠', '♣', '♥', '♦', '★', '☆', '✓', '✗'],
  },
  {
    name: 'Punctuation',
    characters: ['…', '–', '—', '«', '»', '‹', '›', '"', '"', '\u2018', '\u2019', '¡', '¿', '‽', '※'],
  },
]

const tabStyle = (isActive: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  border: 'none',
  borderBottom: isActive ? '2px solid #007AFF' : '2px solid transparent',
  background: 'transparent',
  color: isActive ? '#007AFF' : '#666',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: isActive ? 600 : 400,
})

const charButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #e5e5e5',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 18,
  transition: 'all 0.15s',
}

export function SpecialCharacterDialog(): ReactNode {
  const { eventBus, selectionManager } = useEditorContext()
  const [open, setOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(0)

  const handleOpen = (): void => {
    selectionManager?.saveSelection()
    setOpen(true)
  }

  const handleCharacterClick = (character: string): void => {
    setOpen(false)
    requestAnimationFrame(() => {
      selectionManager?.restoreSelection()
      eventBus.emit(ContentEvents.SPECIAL_CHARACTER_INSERT, { character })
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        onClick={handleOpen}
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
        title="Insert Special Character"
      >
        <Omega size={ICON_SIZE} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
          }}
        />
        <Dialog.Popup
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#fff',
            borderRadius: 8,
            padding: 0,
            minWidth: 400,
            maxWidth: 480,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden',
          }}
        >
          <Dialog.Title
            style={{
              margin: 0,
              padding: '16px 20px',
              fontSize: 18,
              fontWeight: 600,
              borderBottom: '1px solid #e5e5e5',
            }}
          >
            Insert Special Character
          </Dialog.Title>

          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #e5e5e5',
              overflowX: 'auto',
              padding: '0 8px',
            }}
          >
            {categories.map((category, index) => (
              <button
                key={category.name}
                type="button"
                onClick={() => setActiveCategory(index)}
                style={tabStyle(activeCategory === index)}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div
            style={{
              padding: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: 6,
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            {categories[activeCategory].characters.map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => handleCharacterClick(char)}
                style={charButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f0f0f0'
                  e.currentTarget.style.borderColor = '#007AFF'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff'
                  e.currentTarget.style.borderColor = '#e5e5e5'
                }}
                title={char}
              >
                {char}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '12px 16px',
              borderTop: '1px solid #e5e5e5',
              background: '#fafafa',
            }}
          >
            <Dialog.Close
              style={{
                padding: '8px 16px',
                border: '1px solid #ccc',
                borderRadius: 4,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Cancel
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
