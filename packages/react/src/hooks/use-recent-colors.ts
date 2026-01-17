import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY_TEXT = 'sagak-editor-recent-text-colors'
const STORAGE_KEY_BG = 'sagak-editor-recent-bg-colors'
const MAX_RECENT_COLORS = 10

function getStorageKey(type: 'text' | 'background'): string {
  return type === 'text' ? STORAGE_KEY_TEXT : STORAGE_KEY_BG
}

function loadRecentColors(type: 'text' | 'background'): string[] {
  try {
    const stored = localStorage.getItem(getStorageKey(type))
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_RECENT_COLORS)
      }
    }
  } catch {
    // Ignore parse errors
  }
  return []
}

function saveRecentColors(type: 'text' | 'background', colors: string[]): void {
  try {
    localStorage.setItem(getStorageKey(type), JSON.stringify(colors))
  } catch {
    // Ignore storage errors
  }
}

export interface UseRecentColorsReturn {
  recentColors: string[]
  addRecentColor: (color: string) => void
}

export function useRecentColors(type: 'text' | 'background'): UseRecentColorsReturn {
  const [recentColors, setRecentColors] = useState<string[]>(() => loadRecentColors(type))

  useEffect(() => {
    setRecentColors(loadRecentColors(type))
  }, [type])

  const addRecentColor = useCallback((color: string) => {
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c.toLowerCase() !== color.toLowerCase())
      const updated = [color, ...filtered].slice(0, MAX_RECENT_COLORS)
      saveRecentColors(type, updated)
      return updated
    })
  }, [type])

  return {
    recentColors,
    addRecentColor,
  }
}
