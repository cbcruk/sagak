/**
 * 지금 문서를 **사용자의 진짜 파일**로 꺼냅니다.
 *
 * 평소 저장 자리는 OPFS 입니다 — 브라우저 안의 가상 FS 라 사용자에게 안
 * 보입니다. 그것만으로 텍스트 에디터를 삼기에는 두 가지가 걸립니다.
 *
 * 1. `persist()` 가 거절당합니다. 재 보면 브라우저를 껐다 켜도 문서는
 *    남았지만(할당량 276GB), **약속된 것은 아닙니다** — 저장 공간이 심각하게
 *    모자라면 브라우저가 회수할 수 있습니다.
 * 2. 브라우저 밖으로 가져갈 길이 없습니다.
 *
 * 그래서 밖으로 꺼내는 길을 덤으로 답니다. 대체가 아니라 덤인 이유는
 * `showSaveFilePicker` 가 **Chromium 계열에만** 있기 때문입니다 — Safari 와
 * Firefox 에는 없습니다. 기본으로 삼으면 두 브라우저에서 저장이 아예 안
 * 됩니다.
 */

type SaveFilePicker = (options?: {
  suggestedName?: string
  types?: Array<{ description?: string; accept: Record<string, string[]> }>
}) => Promise<FileSystemFileHandle>

function picker(): SaveFilePicker | null {
  const fn = (window as unknown as { showSaveFilePicker?: SaveFilePicker })
    .showSaveFilePicker
  return typeof fn === 'function' ? fn : null
}

/**
 * 이 브라우저에서 진짜 파일로 저장할 수 있는가.
 *
 * 없으면 그 메뉴를 **내놓지 않습니다** — 눌러도 될 일이 없는 것을 보여주지
 * 않는다는 `docs/toolbar-options.md` 의 규칙과 같습니다.
 */
export function canSaveToComputer(): boolean {
  return picker() !== null
}

/**
 * 파일 저장 대화상자를 띄우고 내용을 씁니다.
 *
 * ## 부르는 순서가 중요합니다
 *
 * **반드시 사용자 제스처 안**에서 불러야 합니다. 재 봤습니다 — 제스처 밖이면
 * `SecurityError: Must be handling a user gesture to show a file picker` 입니다.
 *
 * 그래서 내용을 읽기 **전에** 대화상자를 먼저 띄웁니다. `read()` 를 먼저 하면
 * 그 사이의 `await` 가 활성화를 잃을 수 있고, 그러면 눌러도 아무 일이 안
 * 일어나는 것처럼 보입니다.
 *
 * @param read 대화상자에서 고른 **뒤에** 내용을 읽습니다
 * @returns 저장했으면 `true`, 사용자가 취소했으면 `false`
 */
export async function saveToComputer(
  suggestedName: string,
  read: () => Promise<string>
): Promise<boolean> {
  const show = picker()
  if (!show) return false

  let handle: FileSystemFileHandle
  try {
    handle = await show({
      suggestedName,
      types: [
        {
          description: 'HTML document',
          accept: { 'text/html': ['.html'] },
        },
      ],
    })
  } catch (error) {
    /*
     * 취소는 `AbortError` 로 옵니다 — 오류가 아니라 사용자의 답입니다.
     * 나머지는 부르는 쪽이 알아야 하므로 그대로 올립니다.
     */
    if ((error as Error).name === 'AbortError') return false
    throw error
  }

  const writable = await handle.createWritable()
  await writable.write(await read())
  await writable.close()

  return true
}
