import { useState, useId, type ReactNode } from 'preact/compat'
import { Dialog, Button, TabList, Tab } from 'kinu'
import { Omega } from 'lucide-preact'
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
    // 곱은 따옴표 두 쌍. 원래 큰따옴표 자리에 ASCII `"` 가 두 번 들어가 있었습니다
    characters: ['…', '–', '—', '«', '»', '‹', '›', '“', '”', '‘', '’', '¡', '¿', '‽', '※'],
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

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(10, 1fr)',
  gap: 6,
  maxHeight: 240,
  overflowY: 'auto',
} as const

export function SpecialCharacterDialog(): ReactNode {
  const { eventBus, selectionManager } = useEditorContext()
  const [activeCategory, setActiveCategory] = useState(0)
  // kinu 의 Dialog.Content 는 ref 를 DOM 으로 넘기지 않습니다 (link-dialog 참고)
  const dialogId = useId()

  /** `commandfor` 가 다이얼로그를 여는 것과 같은 클릭에서 먼저 실행됩니다 */
  const handleOpen = (): void => {
    selectionManager?.saveSelection()
  }

  const handleCharacterClick = (character: string): void => {
    const dialog = document.getElementById(dialogId)
    if (dialog instanceof HTMLDialogElement) {
      dialog.close()
    }
    requestAnimationFrame(() => {
      selectionManager?.restoreSelection()
      eventBus.emit(ContentEvents.SPECIAL_CHARACTER_INSERT, { character })
    })
  }

  return (
    <Dialog id={dialogId}>
      <Dialog.Trigger>
        <button
          type="button"
          onClick={handleOpen}
          title="Insert Special Character"
          style={triggerStyle}
        >
          <Omega size={ICON_SIZE} />
        </button>
      </Dialog.Trigger>

      <Dialog.Content id={dialogId} aria-label="Insert Special Character">
        <h2>Insert Special Character</h2>

        <TabList>
          {categories.map((category, index) => (
            <Tab
              key={category.name}
              type="button"
              aria-selected={activeCategory === index}
              onClick={() => setActiveCategory(index)}
            >
              {category.name}
            </Tab>
          ))}
        </TabList>

        <div style={gridStyle}>
          {categories[activeCategory].characters.map((char) => (
            <Button
              key={char}
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleCharacterClick(char)}
              title={char}
            >
              {char}
            </Button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Dialog.Close>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog>
  )
}
