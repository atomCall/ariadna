import { useEffect } from 'react'
import { Canvas } from './ui/Canvas'
import { NotePanel } from './ui/NotePanel'
import { Review } from './ui/Review'
import { Toolbar } from './ui/Toolbar'
import { useStore } from './state/store'

const SHORTCUTS: [string, string][] = [
  ['Tab', 'hijo'],
  ['Enter', 'hermano'],
  ['F2', 'renombrar'],
  ['Espacio', 'plegar'],
  ['L', 'enlazar'],
  ['Esc', 'cancelar'],
  ['Alt ↑ ↓', 'mover'],
  ['Alt ← →', 'sangrar'],
  ['Ctrl Z', 'deshacer'],
  ['Ctrl N', 'nota'],
]

export default function App() {
  const ready = useStore((state) => state.ready)
  const map = useStore((state) => state.map)
  const list = useStore((state) => state.list)
  const selectedId = useStore((state) => state.selectedId)
  const notice = useStore((state) => state.notice)
  const theme = useStore((state) => state.theme)
  const load = useStore((state) => state.load)
  const store = useStore

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => store.getState().notify(null), 4200)
    return () => clearTimeout(timer)
  }, [notice, store])

  if (!ready) {
    return <div className="splash">Cargando tu mapa...</div>
  }
  if (!map) return null

  return (
    <div className="app">
      <Toolbar />

      <div className="body">
        <aside className="rail">
          <h2>Mapas</h2>
          <ul className="map-list">
            {list.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={row.id === map.id ? 'active' : ''}
                  onClick={() => void store.getState().openMap(row.id)}
                >
                  <span>{row.title}</span>
                  <small>{new Date(row.updatedAt).toLocaleDateString('es')}</small>
                </button>
              </li>
            ))}
          </ul>

          <h2>Atajos</h2>
          <dl className="shortcuts">
            {SHORTCUTS.map(([key, action]) => (
              <div key={key}>
                <dt>
                  <kbd>{key}</kbd>
                </dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>

          <p className="rail-foot">
            Los nodos con hijos se convierten en preguntas. Los <code>{'{{huecos}}'}</code> de las
            notas, en tarjetas de relleno. Con la tecla <kbd>L</kbd> unes dos nodos con una flecha.
          </p>
        </aside>

        <main className="stage">
          <Canvas onOpenNote={(id) => store.getState().select(id)} />
          {selectedId ? (
            <NotePanel nodeId={selectedId} onClose={() => store.getState().select(null)} />
          ) : null}
        </main>
      </div>

      <Review />
      {notice ? <div className="toast">{notice}</div> : null}
    </div>
  )
}
