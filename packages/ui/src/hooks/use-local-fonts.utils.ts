/**
 * 폰트가 한글을 그릴 수 있는지 **폰트 파일을 직접 열어** 판별합니다.
 *
 * ## 왜 파일까지 여는가 — 쉬운 방법 둘은 못 씁니다
 *
 * | 방법 | 실측 결과 |
 * | --- | --- |
 * | `document.fonts.check('12px "X"', '한글')` | **전부 `true`.** 없는 폰트 이름에도 `true` |
 * | 캔버스 폭 비교 | Apple SD Gothic Neo 를 **미지원으로 오판** |
 *
 * 캔버스 쪽이 틀리는 이유가 중요합니다. macOS 에서 한글의 **대체 폰트가 바로
 * Apple SD Gothic Neo** 라, 비교 기준과 측정 대상이 같아져 차이가 안 납니다.
 * 폴백 체인이 답을 가립니다.
 *
 * ## OS/2 비트도 아닙니다
 *
 * macOS 폰트 메뉴의 "한국어" 묶음(이 기계에서 20개)과 맞춰 봤습니다.
 *
 * | 기준 | 개수 | 빠짐 | 더 |
 * | --- | --- | --- | --- |
 * | **cmap** | 21 | **0** | 1 (`Arial Unicode MS`) |
 * | OS/2 유니코드범위 | 18 | 3 | 1 |
 * | OS/2 코드페이지 949/1361 | 18 | 6 | 4 (Heiti SC/TC 등 **중국어**까지) |
 *
 * Apple 의 묶음은 테이블 비트가 아니라 큐레이션이라 정확히 재현되는 신호가
 * 없습니다. cmap 은 **"한글을 그릴 수 있는가"** 를 답하고, 유일한 차이인
 * `Arial Unicode MS` 는 실제로 한글을 그릴 수 있는 범용 폰트입니다. 에디터가
 * 물어야 할 질문은 그리기 가능 여부이므로 cmap 을 씁니다.
 *
 * ## 파일 전체를 읽지 않습니다
 *
 * `Blob.slice()` 로 필요한 구간만 읽습니다 — 테이블 디렉터리 → `cmap` 오프셋 →
 * 해당 서브테이블. 17.9MB 짜리 `AppleMyungjo` 도 0.5MB 짜리 `Arial` 과 비슷한
 * 비용입니다. 이 기계에서 family 256개를 동시 8개로 훑어 **5.5초**였습니다.
 */

/** 가 · 한 — 완성형 음절 영역의 시작과 대표 글자 */
const HANGUL_PROBE = [0xac00, 0xd55c]

/** `ttcf` — 폰트 컬렉션. 첫 폰트로 건너뜁니다 */
const TTC_TAG = 0x74746366

async function view(blob: Blob, start: number, length: number): Promise<DataView> {
  return new DataView(await blob.slice(start, start + length).arrayBuffer())
}

function tagAt(records: DataView, offset: number): string {
  return String.fromCharCode(
    records.getUint8(offset),
    records.getUint8(offset + 1),
    records.getUint8(offset + 2),
    records.getUint8(offset + 3)
  )
}

async function cmapOffset(blob: Blob): Promise<number> {
  const header = await view(blob, 0, 16)
  const base = header.getUint32(0) === TTC_TAG ? header.getUint32(12) : 0

  const directory = await view(blob, base, 12)
  const count = directory.getUint16(4)
  const records = await view(blob, base + 12, count * 16)

  for (let i = 0; i < count; i += 1) {
    const offset = i * 16
    if (tagAt(records, offset) === 'cmap') return records.getUint32(offset + 8)
  }
  throw new Error('cmap table not found')
}

/**
 * 유니코드 서브테이블을 고릅니다.
 *
 * (3,10) 전체 유니코드 > (3,1) BMP > (0,x) 유니코드 순입니다. 한글 음절은
 * BMP 안이라 (3,1) 로도 충분하지만, 있으면 넓은 쪽을 씁니다.
 */
async function unicodeSubtable(blob: Blob, cmap: number): Promise<number> {
  const header = await view(blob, cmap, 4)
  const count = header.getUint16(2)
  const records = await view(blob, cmap + 4, count * 8)

  let best = -1
  let bestScore = 0

  for (let i = 0; i < count; i += 1) {
    const platform = records.getUint16(i * 8)
    const encoding = records.getUint16(i * 8 + 2)
    const score =
      platform === 3 && encoding === 10
        ? 3
        : platform === 3 && encoding === 1
          ? 2
          : platform === 0
            ? 1
            : 0

    if (score > bestScore) {
      bestScore = score
      best = records.getUint32(i * 8 + 4)
    }
  }

  if (best < 0) throw new Error('no unicode cmap subtable')
  return cmap + best
}

/** format 4 — 세그먼트 방식, BMP 전용. 거의 모든 폰트에 있습니다 */
async function coveredByFormat4(
  blob: Blob,
  start: number,
  codepoints: number[]
): Promise<boolean> {
  const header = await view(blob, start, 14)
  const segX2 = header.getUint16(6)
  const body = await view(blob, start + 14, segX2 * 4 + 2)
  const segments = segX2 / 2

  for (const codepoint of codepoints) {
    let covered = false

    for (let i = 0; i < segments; i += 1) {
      if (codepoint > body.getUint16(i * 2)) continue

      const segStart = body.getUint16(segX2 + 2 + i * 2)
      if (codepoint < segStart) break

      const delta = body.getInt16(segX2 * 2 + 2 + i * 2)
      const rangeOffset = body.getUint16(segX2 * 3 + 2 + i * 2)

      if (rangeOffset === 0) {
        covered = ((codepoint + delta) & 0xffff) !== 0
      } else {
        const address =
          start +
          14 +
          segX2 * 3 +
          2 +
          i * 2 +
          rangeOffset +
          (codepoint - segStart) * 2
        covered = (await view(blob, address, 2)).getUint16(0) !== 0
      }
      break
    }

    if (!covered) return false
  }

  return true
}

/** format 12 — 그룹 방식, BMP 밖까지. 요즘 폰트가 함께 싣습니다 */
async function coveredByFormat12(
  blob: Blob,
  start: number,
  codepoints: number[]
): Promise<boolean> {
  const header = await view(blob, start, 16)
  const count = header.getUint32(12)
  const groups = await view(blob, start + 16, count * 12)

  for (const codepoint of codepoints) {
    let covered = false

    for (let i = 0; i < count; i += 1) {
      const groupStart = groups.getUint32(i * 12)
      if (codepoint < groupStart) break
      if (codepoint <= groups.getUint32(i * 12 + 4)) {
        covered = true
        break
      }
    }

    if (!covered) return false
  }

  return true
}

/**
 * 이 폰트가 한글을 그릴 수 있으면 `true`.
 *
 * 읽지 못하는 폰트는 **`false`** 입니다. 이 기계에서 실패한 넷은 전부
 * `Webdings`·`Wingdings` 계열(cmap format 0)이라 어차피 한글이 없습니다.
 * 못 읽었을 때 목록에 넣는 것보다 빼는 쪽이 덜 틀립니다.
 */
export async function supportsKorean(blob: Blob): Promise<boolean> {
  try {
    const subtable = await unicodeSubtable(blob, await cmapOffset(blob))
    const format = (await view(blob, subtable, 4)).getUint16(0)

    if (format === 4) return coveredByFormat4(blob, subtable, HANGUL_PROBE)
    if (format === 12) return coveredByFormat12(blob, subtable, HANGUL_PROBE)
    return false
  } catch {
    return false
  }
}
