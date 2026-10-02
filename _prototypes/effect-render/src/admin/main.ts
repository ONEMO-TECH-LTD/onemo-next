import './styles.css'
import { el } from './controls'
import { panel } from './panel'
import { preview } from './preview'

const statusLine = el('div', 'status')
let timer = 0
function status(msg: string): void {
  statusLine.textContent = msg
  statusLine.classList.add('show')
  clearTimeout(timer)
  timer = window.setTimeout(() => statusLine.classList.remove('show'), 2500)
}

const header = el('header', 'top')
header.append(el('h1', '', 'Effect render'), el('span', 'sub', 'engine + admin · prototype'))
document.getElementById('app')!.append(header, preview(), panel(status), statusLine)
