import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { Dialog, Button, TabList, Tab } from 'kinu'
import { Omega } from 'lucide-preact'
import { ContentEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { useDialogHandle } from '../../hooks/use-dialog-handle'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

const ICON_SIZE = 18

interface CharacterCategory {
  name: string
  characters: string[]
}

const categories: CharacterCategory[] = [
  {
    name: 'Arrows',
    characters: [
      '←',
      '→',
      '↑',
      '↓',
      '↔',
      '↕',
      '⇐',
      '⇒',
      '⇑',
      '⇓',
      '⇔',
      '⇕',
      '➜',
      '➔',
      '➝',
      '➞',
    ],
  },
  {
    name: 'Math',
    characters: [
      '±',
      '×',
      '÷',
      '≠',
      '≈',
      '≤',
      '≥',
      '∞',
      '∑',
      '∏',
      '√',
      '∫',
      '∂',
      '∆',
      '∇',
      '∈',
      '∉',
      '⊂',
      '⊃',
      '∪',
      '∩',
    ],
  },
  {
    name: 'Currency',
    characters: ['$', '€', '£', '¥', '₩', '¢', '₹', '₽', '฿', '₿', '₺', '₴'],
  },
  {
    name: 'Greek',
    characters: [
      'α',
      'β',
      'γ',
      'δ',
      'ε',
      'ζ',
      'η',
      'θ',
      'ι',
      'κ',
      'λ',
      'μ',
      'ν',
      'ξ',
      'ο',
      'π',
      'ρ',
      'σ',
      'τ',
      'υ',
      'φ',
      'χ',
      'ψ',
      'ω',
    ],
  },
  {
    name: 'Symbols',
    characters: [
      '©',
      '®',
      '™',
      '§',
      '¶',
      '†',
      '‡',
      '•',
      '°',
      '′',
      '″',
      '‰',
      '№',
      '℃',
      '℉',
      '♠',
      '♣',
      '♥',
      '♦',
      '★',
      '☆',
      '✓',
      '✗',
    ],
  },
  {
    name: 'Punctuation',
    // 곱은 따옴표 두 쌍. 원래 큰따옴표 자리에 ASCII `"` 가 두 번 들어가 있었습니다
    characters: [
      '…',
      '–',
      '—',
      '«',
      '»',
      '‹',
      '›',
      '“',
      '”',
      '‘',
      '’',
      '¡',
      '¿',
      '‽',
      '※',
    ],
  },
]

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(10, 1fr)',
  gap: 6,
  maxHeight: 240,
  overflowY: 'auto',
} as const

export function SpecialCharacterDialog(): ComponentChildren {
  const { eventBus } = useEditorContext()
  const [activeCategory, setActiveCategory] = useState(0)
  const { id: dialogId, save, restoreThen } = useDialogHandle()

  const handleCharacterClick = (character: string): void => {
    restoreThen(() =>
      eventBus.emit(ContentEvents.SPECIAL_CHARACTER_INSERT, { character })
    )
  }

  return (
    <Dialog id={dialogId}>
      <Dialog.Trigger>
        {/* `commandfor` 가 다이얼로그를 여는 것과 같은 클릭에서 먼저 실행됩니다 */}
        <ToolbarButton title="Insert Special Character" onClick={save}>
          <Omega size={ICON_SIZE} aria-hidden="true" />
        </ToolbarButton>
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
