import type { ComponentChildren, JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { X } from 'lucide-preact'
import { FontEvents } from 'sagak-core'
import { useEditorContext } from '../../context/editor-context'
import { useRecentColors } from '../../hooks/use-recent-colors'
import { ToolbarButton } from '../toolbar-button/toolbar-button'
import { PRESET_COLORS } from './color-picker.shared'


const popoverStyle: JSX.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  padding: 8,
  background: 'var(--sagak-chrome-bg)',
  border: '1px solid var(--sagak-chrome-border)',
  borderRadius: 6,
  boxShadow: '0 2px 8px var(--sagak-shadow)',
  zIndex: 1000,
  width: 220,
}

const colorGridStyle: JSX.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(10, 1fr)',
  gap: 2,
}

const colorSwatchStyle = (color: string, isSelected: boolean): JSX.CSSProperties => ({
  width: 18,
  height: 18,
  background: color,
  border: isSelected
    ? '2px solid var(--sagak-accent)'
    : '1px solid var(--sagak-chrome-border)',
  borderRadius: 2,
  cursor: 'pointer',
})

export interface ColorPickerProps {
  type: 'text' | 'background'
}

export function ColorPicker({ type }: ColorPickerProps): ComponentChildren {
  const editorContext = useEditorContext()
  const [isOpen, setIsOpen] = useState(false)
  const [currentColor, setCurrentColor] = useState(type === 'text' ? '#000000' : '#ffff00')
  const containerRef = useRef<HTMLDivElement>(null)
  const { recentColors, addRecentColor } = useRecentColors(type)

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
    addRecentColor(color)

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
      <ToolbarButton title={isTextColor ? 'Text Color' : 'Highlight Color'} onClick={() => setIsOpen(!isOpen)}>
        {isTextColor ? (
          <div
            style={{
              width: 16,
              height: 16,
              background: currentColor,
              borderRadius: 2,
              border:
                currentColor === '#ffffff'
                  ? '1px solid var(--sagak-chrome-border)'
                  : 'none',
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
                border: '1px solid var(--sagak-chrome-border)',
              }}
            />
            <X
              size={10}
              style={{
                position: 'absolute',
                top: 3,
                left: 3,
                color: 'var(--sagak-chrome-muted-fg)',
              }}
            />
          </div>
        )}
      </ToolbarButton>

      {isOpen && (
        <div style={popoverStyle}>
          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--sagak-chrome-muted-fg)' }}>
            {isTextColor ? 'Text Color' : 'Highlight Color'}
          </div>

          {recentColors.length > 0 && (
            <>
              <div style={{ marginBottom: 4, fontSize: 11, color: 'var(--sagak-chrome-muted-fg)' }}>
                Recent
              </div>
              <div style={{ ...colorGridStyle, marginBottom: 8 }}>
                {recentColors.map((color) => (
                  <button
                    key={`recent-${color}`}
                    type="button"
                    style={colorSwatchStyle(color, color === currentColor)}
                    onClick={() => handleColorSelect(color)}
                    title={color}
                  />
                ))}
              </div>
            </>
          )}

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
                border: '1px solid var(--sagak-chrome-border)',
                borderRadius: 4,
                background: 'var(--sagak-chrome-bg)',
                color: 'var(--sagak-chrome-fg)',
                cursor: 'pointer',
                fontSize: 12,
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
