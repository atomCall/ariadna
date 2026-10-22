import type { MindMap } from '../domain/types'
import type { ReviewRecord } from '../domain/scheduler'

export interface AriadnaFile {
  format: 'ariadna'
  version: 1
  map: MindMap
  reviews: Record<string, ReviewRecord>
}

export function download(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'mapa'
  )
}

export function readFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      resolve({ name: file.name, text: await file.text() })
    }
    input.click()
  })
}

export function parseFile(text: string): AriadnaFile | null {
  try {
    const data = JSON.parse(text) as AriadnaFile
    if (data && data.format === 'ariadna' && data.map && data.map.rootId) return data
    return null
  } catch {
    return null
  }
}
