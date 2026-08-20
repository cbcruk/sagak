<script lang="ts">
  import { Image as ImageIcon, Link as LinkIcon, Upload } from 'lucide'
  import { imageOf, imageUpload, ALLOWED_IMAGE_TYPES } from 'sagak-core'
  import { exec } from '../state/exec'
  import type { EditorContext } from 'sagak-core'
  import { icon } from '../elements/icon'

  /**
   * 이미지 다이얼로그 — **Svelte 로 방향을 바꾼 이유를 확인하는 자리**입니다.
   *
   * 지금까지 옮긴 것들은 상태가 한둘이라 어느 렌더러든 비슷했습니다. 여기는
   * 상태가 **아홉 개**고 서로 물려 있습니다(모드·URL·대체문구·크기 둘·편집
   * 여부·업로드 오류·미리보기·고른 파일). nanotags 로 했다면 이 아홉을
   * `paint()` 하나에 손으로 엮어야 했습니다.
   *
   * Svelte 에서는 `$state` 로 두고 마크업이 알아서 따라옵니다. **이 차이가
   * 방향 전환의 값입니다** — 툴바 버튼에서는 안 보이던 것이 여기서 보입니다.
   *
   * ## 다이얼로그는 여전히 네이티브입니다
   *
   * kinu 를 걷어내면서 확인한 대로 `<dialog>` + `showModal()` 을 그대로 씁니다.
   * 포커스 트랩·Esc·백드롭은 브라우저가 합니다. 렌더러를 바꿔도 이 부분은
   * 안 바뀝니다.
   *
   * ## 열 때의 순서가 중요합니다
   *
   * 1. 여는 클릭에서 **선택 영역을 저장**하고 기존 값을 미리 채웁니다
   * 2. 적용은 **닫은 다음 프레임**에 합니다 — 닫히기 전에 되돌리면 다이얼로그가
   *    아직 포커스를 쥐고 있어 선택이 다시 풀립니다
   */

  interface Props {
    editor: EditorContext
    /** 좁은 화면에서 트리거를 감춥니다 — 자세한 이유는 아래 */
    hideTrigger?: boolean
  }

  const { editor, hideTrigger = false }: Props = $props()

  type UploadMode = 'url' | 'file'

  let dialogEl: HTMLDialogElement
  let fileInput: HTMLInputElement | undefined = $state()

  let mode = $state<UploadMode>('url')
  let src = $state('')
  let alt = $state('')
  let width = $state('')
  let height = $state('')
  let isEditing = $state(false)
  let uploadError = $state<string | null>(null)
  let previewUrl = $state<string | null>(null)
  let selectedFile = $state<File | null>(null)

  const canSubmit = $derived(
    mode === 'url' ? src.trim().length > 0 : previewUrl !== null
  )

  /** 새로 넣는가 고치는가 — 파일 갈래는 늘 새로 넣습니다 */
  const command = $derived(
    mode === 'file' || !isEditing ? 'insertImage' : 'updateImage'
  )

  function resetUpload(): void {
    selectedFile = null
    previewUrl = null
    uploadError = null
  }

  export function open(): void {

    /* 모델에 물어봅니다 — `<img>` 요소를 찾아 스타일을 읽던 자리입니다 */
    const img = imageOf(editor)
    src = img?.src ?? ''
    alt = img?.alt ?? ''
    width = img?.width ?? ''
    height = img?.height ?? ''
    isEditing = !!img
    mode = 'url'
    resetUpload()

    dialogEl.showModal()
  }

  /**
   * 닫은 **다음 프레임**에 적용합니다.
   *
   * 예전에는 여기서 선택 영역도 되돌렸습니다 — 다이얼로그가 포커스를 가져가면
   * 브라우저 선택이 풀렸기 때문입니다. 이제 선택은 문서 상태의 일부라 그럴
   * 필요가 없지만, **닫고 나서 적용한다** 는 순서는 남습니다. 다이얼로그가 아직
   * 열려 있는 동안 커맨드를 돌리면 포커스 되돌리기가 그 위에서 일어납니다.
   */
  function restoreThen(action: () => void): void {
    dialogEl.close()
    requestAnimationFrame(() => {
      action()
    })
  }

  function submit(): void {
    if (mode === 'file' && previewUrl) {
      const preview = previewUrl
      const name = selectedFile?.name
      restoreThen(() => {
        exec(editor, 'insertImage', {
          src: preview,
          alt: alt.trim() || name || null,
          width: width.trim() || null,
          height: height.trim() || null,
        })
      })
      return
    }

    if (mode !== 'url') return

    const trimmed = src.trim()
    /* src 가 비어 있어도 닫기는 합니다 */
    if (!trimmed) {
      dialogEl.close()
      return
    }

    const payload = {
      src: trimmed,
      alt: alt.trim() || null,
      width: width.trim() || null,
      height: height.trim() || null,
    }
    const target = command

    restoreThen(() => {
      if (target === 'insertImage') exec(editor, 'insertImage', payload)
      else exec(editor, 'updateImage', payload)
    })
  }

  function remove(): void {
    restoreThen(() => void exec(editor, 'deleteImage'))
  }

  /**
   * 파일을 **코어에게 읽힙니다.**
   *
   * 예전에는 여기가 형식 검사·크기 검사·`FileReader` 를 직접 했습니다.
   * 코어에도 똑같은 것이 있었지만 `IMAGE_UPLOAD_FROM_FILE` 이벤트 뒤에
   * 숨어 있었고 아무도 그것을 부르지 않았습니다 — 문을 못 찾으니 옆에 문을
   * 하나 더 뚫은 셈입니다.
   *
   * 이제 한 벌입니다. `onUpload` 를 준 사람은 다이얼로그에서 고른 파일도
   * 자기 서버로 갑니다 — 예전에는 끌어다 놓기만 그랬습니다.
   *
   * 넣지는 않고 **읽기만** 합니다. 미리 보여 주고 대체문구·크기를 받은 뒤에
   * 넣는 것이 이 다이얼로그의 일이기 때문입니다.
   */
  async function acceptFile(file: File): Promise<void> {
    uploadError = null

    const result = await imageUpload(editor).read(file)

    if (!result.ok) {
      uploadError = result.message
      return
    }

    selectedFile = file
    alt = result.name.replace(/\.[^/.]+$/, '')
    previewUrl = result.url
  }

  function onFileInput(e: Event): void {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (file) void acceptFile(file)
  }

  function onDrop(e: DragEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('image/')) void acceptFile(file)
  }
</script>

<button
  type="button"
  data-part="icon-button"
  data-mobile={hideTrigger ? 'hidden' : undefined}
  title="Insert Image"
  aria-label="Insert Image"
  onclick={open}
>
  {@html icon(ImageIcon, 18).outerHTML}
</button>

<dialog bind:this={dialogEl} k="dialog-content" aria-label={isEditing ? 'Edit Image' : 'Insert Image'}>
  <h2>{isEditing ? 'Edit Image' : 'Insert Image'}</h2>

  {#if !isEditing}
    <div role="group" aria-label="Image source">
      <button type="button" k="toggle" aria-pressed={mode === 'url'} onclick={() => (mode = 'url')}>
        {@html icon(LinkIcon, 16).outerHTML}
        URL
      </button>
      <button type="button" k="toggle" aria-pressed={mode === 'file'} onclick={() => (mode = 'file')}>
        {@html icon(Upload, 16).outerHTML}
        Upload
      </button>
    </div>
  {/if}

  {#if mode === 'url'}
    <div>
      <label k="label" for="image-url">Image URL *</label>
      <input
        id="image-url"
        k="input"
        type="text"
        bind:value={src}
        placeholder="https://example.com/image.jpg"
      />
    </div>
  {/if}

  {#if mode === 'file' && !isEditing}
    <div>
      <input
        bind:this={fileInput}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        onchange={onFileInput}
        style="display: none"
      />
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        onclick={() => fileInput?.click()}
        ondrop={onDrop}
        ondragover={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        {#if previewUrl}
          <img src={previewUrl} alt="Preview" style="max-width: 100%; max-height: 150px" />
          <p>{selectedFile?.name}</p>
          <button
            type="button"
            k="button"
            variant="outline"
            onclick={(e) => {
              e.stopPropagation()
              resetUpload()
              if (fileInput) fileInput.value = ''
            }}
          >
            Remove
          </button>
        {:else}
          {@html icon(Upload, 32).outerHTML}
          <p>Click to select or drag and drop</p>
          <p>JPEG, PNG, GIF, WebP (max 5MB)</p>
        {/if}
      </div>
      {#if uploadError}
        <p role="alert">{uploadError}</p>
      {/if}
    </div>
  {/if}

  <div>
    <label k="label" for="image-alt">Alt Text</label>
    <input id="image-alt" k="input" type="text" bind:value={alt} placeholder="Image description" />
  </div>

  <div style="display: flex; gap: 12px">
    <div style="flex: 1">
      <label k="label" for="image-width">Width</label>
      <input id="image-width" k="input" type="text" bind:value={width} placeholder="300px or 50%" />
    </div>
    <div style="flex: 1">
      <label k="label" for="image-height">Height</label>
      <input id="image-height" k="input" type="text" bind:value={height} placeholder="auto" />
    </div>
  </div>

  <div style="display: flex; gap: 8px; justify-content: flex-end">
    {#if isEditing}
      <button type="button" k="button" variant="destructive" onclick={remove}>Delete</button>
    {/if}
    <button type="button" k="button" variant="outline" onclick={() => dialogEl.close()}>
      Cancel
    </button>
    <button type="button" k="button" onclick={submit} disabled={!canSubmit}>
      {isEditing ? 'Update' : 'Insert'}
    </button>
  </div>
</dialog>
