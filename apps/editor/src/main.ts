import { mount } from 'svelte'
import App from './App.svelte'
import 'sagak-ui/styles'
import './index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('#root 요소를 찾을 수 없습니다')
}

mount(App, { target: container })
