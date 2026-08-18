import { sagakSchema, parseHtml, toHtml } from 'sagak-core'

/**
 * **진짜 클립보드를 받아 보는 자리**입니다.
 *
 * `paste.test.ts` 의 표본은 각 앱이 넣는 꼴을 **본떠 쓴 것**이라, 통과해도
 * "붙여넣기가 된다" 를 증명하지 못합니다. 진짜 HTML 은 사람이 실제로 복사해야
 * 나오고, 그건 검사가 대신할 수 없습니다.
 *
 * 그래서 사람이 2분 쓰면 되는 도구로 만듭니다 — 붙여넣으면 그 자리에서
 * 왕복시켜 결과를 보여주고, 픽스처로 쓸 수 있게 복사해 줍니다.
 *
 * ```
 * cd spike/pm-schema && npx vite tools
 * ```
 */

const out = document.querySelector<HTMLDivElement>('#out')!
let lastFixture = ''

function escape(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function spanDepth(html: string): number {
  const el = document.createElement('div')
  el.innerHTML = html

  let deepest = 0
  for (const span of el.querySelectorAll('span')) {
    let depth = 0
    for (let node: HTMLElement | null = span; node; node = node.parentElement) {
      if (node.tagName === 'SPAN') depth += 1
    }
    deepest = Math.max(deepest, depth)
  }
  return deepest
}

function verdict(ok: boolean, label: string): string {
  return `<span class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${label}</span>`
}

document.addEventListener('paste', (event: ClipboardEvent) => {
  event.preventDefault()

  const html = event.clipboardData?.getData('text/html') ?? ''
  const plain = event.clipboardData?.getData('text/plain') ?? ''

  if (!html) {
    out.innerHTML = `<p class="bad">클립보드에 <code>text/html</code> 이 없습니다. 평문만 왔습니다.</p><pre>${escape(plain)}</pre>`
    return
  }

  const output = toHtml(parseHtml(html, sagakSchema, document), sagakSchema, document)
  const probe = document.createElement('div')
  probe.innerHTML = html
  const source = document.createElement('div')
  source.innerHTML = output
  const strip = (text: string | null) => (text ?? '').replace(/\s+/g, '')

  const result = {
    output,
    lost: strip(probe.textContent) !== strip(source.textContent),
    stable:
      toHtml(parseHtml(output, sagakSchema, document), sagakSchema, document) ===
      output,
    changed: true,
  }

  lastFixture = [
    '  {',
    `    name: '',`,
    '    html: `' + html.replace(/`/g, '\\`').replace(/\$/g, '\\$') + '`,',
    '  },',
  ].join('\n')

  out.innerHTML = `
    <p class="verdicts">
      ${verdict(!result.lost, '손실 없음')}
      ${verdict(result.stable, '안정')}
      <span class="note">span 최대 겹: ${spanDepth(result.output)}</span>
      <span class="note">${result.changed ? '마크업 달라짐' : '마크업 그대로'}</span>
    </p>

    <button id="copy">픽스처로 복사</button>

    <h2>왕복 후 (이렇게 저장됩니다)</h2>
    <div class="render">${result.output}</div>
    <pre>${escape(result.output)}</pre>

    <h2>들어온 것 (클립보드 원본)</h2>
    <pre>${escape(html)}</pre>
  `

  document.querySelector('#copy')?.addEventListener('click', () => {
    void navigator.clipboard.writeText(lastFixture)
  })
})
