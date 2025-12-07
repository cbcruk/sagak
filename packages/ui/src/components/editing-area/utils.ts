/**
 * 모든 태그를 제거하여 HTML을 순수 텍스트로 변환합니다
 */
export function htmlToText(html: string): string {
  const temp = document.createElement('div')
  temp.innerHTML = html
  return temp.textContent || temp.innerText || ''
}

/**
 * 단락으로 감싸서 순수 텍스트를 HTML로 변환합니다
 */
export function textToHtml(text: string): string {
  if (!text.trim()) return '<p><br></p>'

  const lines = text.split('\n')

  return lines
    .map((line) => {
      const trimmed = line.trim()
      return trimmed ? `<p>${trimmed}</p>` : '<p><br></p>'
    })
    .join('')
}
