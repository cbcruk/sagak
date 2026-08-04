import { render } from 'preact'
import { App } from './app'
import 'sagak-editor/styles'
import './index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('#root 요소를 찾을 수 없습니다')
}

render(<App />, container)
