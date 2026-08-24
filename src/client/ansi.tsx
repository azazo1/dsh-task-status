import type { CSSProperties, ReactNode } from 'react'

interface TerminalStyle {
  color?: string
  backgroundColor?: string
  fontWeight?: CSSProperties['fontWeight']
  fontStyle?: CSSProperties['fontStyle']
  textDecoration?: CSSProperties['textDecoration']
  opacity?: number
}

const ANSI_PATTERN = /\x1b\[([0-9;?]*)([ -/]*)([@-~])/g
const ANSI_COLORS = [
  '#1f1f1f',
  '#c93c37',
  '#2e9b55',
  '#b58900',
  '#357edd',
  '#9256a8',
  '#218c8d',
  '#d8d8d8',
]
const ANSI_BRIGHT_COLORS = [
  '#666666',
  '#f05d5e',
  '#5fcf80',
  '#e5c07b',
  '#6fa8ff',
  '#c678dd',
  '#56d4d4',
  '#ffffff',
]

function ansi256Color(value: number): string | undefined {
  if (value < 0 || value > 255) return undefined
  if (value < 16) return (value < 8 ? ANSI_COLORS : ANSI_BRIGHT_COLORS)[value % 8]
  if (value >= 232) {
    const level = 8 + (value - 232) * 10
    return `rgb(${level}, ${level}, ${level})`
  }
  const index = value - 16
  const red = Math.floor(index / 36)
  const green = Math.floor((index % 36) / 6)
  const blue = index % 6
  const channel = (component: number): number => component === 0 ? 0 : 55 + component * 40
  return `rgb(${channel(red)}, ${channel(green)}, ${channel(blue)})`
}

function readColor(values: number[], index: number): { color?: string; next: number } {
  const mode = values[index + 1]
  if (mode === 5) return { color: ansi256Color(values[index + 2] ?? -1), next: index + 2 }
  if (mode === 2) {
    const red = values[index + 2]
    const green = values[index + 3]
    const blue = values[index + 4]
    if ([red, green, blue].every(channel => channel !== undefined && channel >= 0 && channel <= 255)) {
      return { color: `rgb(${red}, ${green}, ${blue})`, next: index + 4 }
    }
  }
  return { next: index }
}

function applySgr(style: TerminalStyle, values: number[]): number {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? 0
    if (value === 0) {
      delete style.color
      delete style.backgroundColor
      delete style.fontWeight
      delete style.fontStyle
      delete style.textDecoration
      delete style.opacity
    } else if (value === 1) {
      style.fontWeight = 700
    } else if (value === 2) {
      style.opacity = 0.72
    } else if (value === 3) {
      style.fontStyle = 'italic'
    } else if (value === 4) {
      style.textDecoration = 'underline'
    } else if (value === 22) {
      style.fontWeight = undefined
      style.opacity = undefined
    } else if (value === 23) {
      style.fontStyle = undefined
    } else if (value === 24) {
      style.textDecoration = undefined
    } else if (value === 39) {
      style.color = undefined
    } else if (value === 49) {
      style.backgroundColor = undefined
    } else if (value >= 30 && value <= 37) {
      style.color = ANSI_COLORS[value - 30]
    } else if (value >= 40 && value <= 47) {
      style.backgroundColor = ANSI_COLORS[value - 40]
    } else if (value >= 90 && value <= 97) {
      style.color = ANSI_BRIGHT_COLORS[value - 90]
    } else if (value >= 100 && value <= 107) {
      style.backgroundColor = ANSI_BRIGHT_COLORS[value - 100]
    } else if (value === 38 || value === 48) {
      const color = readColor(values, index)
      if (color.color !== undefined) {
        if (value === 38) style.color = color.color
        else style.backgroundColor = color.color
      }
      index = color.next
    }
  }
  return values.length
}

function styleKey(style: TerminalStyle): string {
  return JSON.stringify(style)
}

/** 将带 ANSI 控制序列的文本拆成可安全渲染的终端片段. */
export function renderAnsi(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const style: TerminalStyle = {}
  let cursor = 0
  let segmentStart = 0
  let key = 0
  const pushText = (value: string): void => {
    if (value === '') return
    nodes.push(<span key={`${styleKey(style)}-${key}`} style={{ ...style }}>{value}</span>)
    key += 1
  }

  text.replace(ANSI_PATTERN, (sequence, params: string, _intermediates: string, command: string, offset: number) => {
    pushText(text.slice(segmentStart, offset))
    segmentStart = offset + sequence.length
    if (command === 'm') {
      const values = params === '' ? [0] : params.split(';').map(Number)
      applySgr(style, values)
    }
    return sequence
  })
  pushText(text.slice(segmentStart))
  return nodes
}
