import { it, expect } from 'vitest'
import { mountEditor, settle, placeCaretInText } from './harness'

it('한글 조합 중 선택 영역을 몇 번 훑는가', async () => {
  const ed = await mountEditor('<p>안녕</p>')
  placeCaretInText(ed.editable, 2)
  await settle(4)

  const original = window.getSelection.bind(window)
  let calls = 0
  window.getSelection = () => { calls += 1; return original() }

  const fire = async (n: number) => {
    for (let i = 0; i < n; i += 1) {
      document.dispatchEvent(new Event('selectionchange'))
      await settle(1)
    }
  }

  calls = 0
  await fire(10)
  const normal = calls

  calls = 0
  ed.editable.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  await fire(10)
  const during = calls
  ed.editable.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
  await settle(4)

  window.getSelection = original
  console.log(`평상시  : ${normal}회 (이벤트당 ${(normal / 10).toFixed(1)})`)
  console.log(`조합 중 : ${during}회 (이벤트당 ${(during / 10).toFixed(1)}) = 평상시의 ${Math.round((during / normal) * 100)}%`)
  expect(during).toBeGreaterThan(0)
  ed.unmount()
})
