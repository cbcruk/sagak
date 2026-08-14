import type { ComponentChildren } from 'preact'
import { SvelteHost } from '../../svelte/host'
import AutocompletePopoverSvelte from '../../svelte/AutocompletePopover.svelte'

/**
 * 자동 완성 팝오버 — **Svelte 판을 감싸는 껍데기**입니다.
 *
 * 안쪽은 `svelte/AutocompletePopover.svelte` 입니다. 툴바·문서 줄과 같은
 * 모양이고, 앱 진입점이 Svelte 가 되면 셋이 함께 사라집니다.
 */

export function AutocompletePopover(): ComponentChildren {
  return <SvelteHost component={AutocompletePopoverSvelte} />
}
