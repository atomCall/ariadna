/**
 * @vitest-environment jsdom
 */
import 'fake-indexeddb/auto'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../src/App'
import { useStore } from '../src/state/store'

declare global {
  // React necesita saber que corremos dentro de act().
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver

let host: HTMLDivElement
let root: Root

async function settle(ms = 60) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

beforeEach(async () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(<App />)
  })
  await settle()
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  host.remove()
})

describe('aplicación', () => {
  it('abre con un mapa nuevo y su nodo central', async () => {
    expect(host.textContent).toContain('ariadna')
    expect(host.textContent).toContain('el mapa es el mazo')
    expect(host.querySelectorAll('.node').length).toBe(1)
    expect(host.textContent).toContain('Tema central')
    expect(host.querySelector('.canvas')).not.toBeNull()
  })

  it('crea un hijo con Tab y abre el editor en línea', async () => {
    const canvas = host.querySelector('.canvas') as HTMLElement
    await act(async () => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    })
    await settle(20)

    expect(host.querySelectorAll('.node').length).toBe(2)
    const input = host.querySelector('.node-input') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.value).toBe('Nuevo nodo')
    expect(useStore.getState().map?.nodes[useStore.getState().selectedId as string]?.text).toBe(
      'Nuevo nodo',
    )
  })

  it('deriva una tarjeta del nodo con hijos y permite repasarla', async () => {
    const state = useStore.getState()
    const map = state.map
    expect(map).not.toBeNull()

    await act(async () => {
      state.select(map!.rootId)
    })
    await act(async () => {
      useStore.getState().addChild()
    })
    await act(async () => {
      useStore.getState().renameNode(useStore.getState().selectedId as string, 'Primera rama')
    })

    await act(async () => {
      useStore.getState().startReview()
    })
    await settle(20)

    expect(useStore.getState().session?.cards.length).toBe(1)
    expect(host.querySelector('.review-front')?.textContent).toBe('¿Qué cuelga de «Tema central»?')

    await act(async () => {
      useStore.getState().reveal()
    })
    expect(host.querySelector('.review-back')?.textContent).toContain('Primera rama')

    await act(async () => {
      useStore.getState().grade('good')
    })
    await settle(20)

    expect(useStore.getState().session).toBeNull()
    expect(Object.keys(useStore.getState().reviews).length).toBe(1)
  })
})
