import type { ReactNode } from 'react'
import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { FontEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'

const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
  '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
  '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
  '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130',
]

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  padding: 8,
  background: '#fff',
  border: '1px solid #d4d4d4',
  borderRadius: 6,
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  zIndex: 1000,
  width: 220,
}

const colorGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(10, 1fr)',
  gap: 2,
}

const colorSwatchStyle = (color: string, isSelected: boolean): React.CSSProperties => ({
  width: 18,
  height: 18,
  background: color,
  border: isSelected ? '2px solid #007AFF' : '1px solid #e5e5e5',
  borderRadius: 2,
  cursor: 'pointer',
})

export interface ColorPickerProps {
  type: 'text' | 'background'
}

export function ColorPicker({ type }: ColorPickerProps): ReactNode {
  const editorContext = useEditorContext()
  const [isOpen, setIsOpen] = useState(false)
  const [currentColor, setCurrentColor] = useState(type === 'text' ? '#000000' : '#ffff00')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  function handleColorSelect(color: string): void {
    setCurrentColor(color)
    setIsOpen(false)

    const eventName = type === 'text'
      ? FontEvents.TEXT_COLOR_CHANGED
      : FontEvents.BACKGROUND_COLOR_CHANGED

    editorContext.eventBus.emit(eventName, { color })
  }

  function handleRemoveColor(): void {
    setIsOpen(false)
    const eventName = type === 'text'
      ? FontEvents.TEXT_COLOR_CHANGED
      : FontEvents.BACKGROUND_COLOR_CHANGED
    editorContext.eventBus.emit(eventName, { color: type === 'text' ? '#000000' : 'transparent' })
    setCurrentColor(type === 'text' ? '#000000' : '#ffff00')
  }

  const isTextColor = type === 'text'

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          border: '1px solid #d4d4d4',
          borderRadius: 4,
          background: '#fff',
          cursor: 'pointer',
          padding: 2,
        }}
        title={isTextColor ? 'Text Color' : 'Highlight Color'}
      >
        {isTextColor ? (
          <div
            style={{
              width: 16,
              height: 16,
              background: currentColor,
              borderRadius: 2,
              border: currentColor === '#ffffff' ? '1px solid #d4d4d4' : 'none',
            }}
          />
        ) : (
          <div style={{ position: 'relative', width: 16, height: 16 }}>
            <div
              style={{
                width: 16,
                height: 16,
                background: currentColor,
                borderRadius: 2,
                border: '1px solid #d4d4d4',
              }}
            />
            <X
              size={10}
              style={{
                position: 'absolute',
                top: 3,
                left: 3,
                color: '#666',
              }}
            />
          </div>
        )}
      </button>

      {isOpen && (
        <div style={popoverStyle}>
          <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
            {isTextColor ? 'Text Color' : 'Highlight Color'}
          </div>
          <div style={colorGridStyle}>
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                style={colorSwatchStyle(color, color === currentColor)}
                onClick={() => handleColorSelect(color)}
                title={color}
              />
            ))}
          </div>
          {!isTextColor && (
            <button
              type="button"
              onClick={handleRemoveColor}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                marginTop: 8,
                padding: '6px 8px',
                border: '1px solid #d4d4d4',
                borderRadius: 4,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                color: '#666',
              }}
            >
              <X size={12} />
              Remove Highlight
            </button>
          )}
        </div>
      )}
    </div>
  )
}
