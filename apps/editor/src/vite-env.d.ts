/// <reference types="vite/client" />

/*
 * TS 7 부터 부수효과 import(`import './x.css'`)도 모듈 선언을 요구합니다.
 * `*.css` 는 위의 `vite/client` 가 선언해 주지만, `sagak-ui/styles` 는
 * 확장자가 없는 vite alias 라 그 와일드카드에 걸리지 않습니다.
 */
declare module 'sagak-ui/styles'
