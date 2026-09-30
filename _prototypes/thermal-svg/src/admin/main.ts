import './styles.css'
import { startAutoLayout } from './layout'
import { el } from './controls'
import { installPageFonts } from './fonts'
import { panel } from './panel'
import { preview } from './preview'

installPageFonts()

const statusLine = el('div', 'status')
let timer = 0
function status(msg: string): void {
  statusLine.textContent = msg
  statusLine.classList.add('show')
  clearTimeout(timer)
  timer = window.setTimeout(() => statusLine.classList.remove('show'), 2500)
}

const header = el('header', 'top')
header.append(el('h1', '', 'Thermal SVG'), el('span', 'sub', 'engine + admin · prototype'))

const app = document.getElementById('app')!
app.append(header, preview(status), panel(status), statusLine)
startAutoLayout()
