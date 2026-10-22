import { useEffect } from 'react'
import { GRADE_LABELS, type Grade } from '../domain/scheduler'
import { useStore } from '../state/store'

const KEYS: Record<string, Grade> = {
  '1': 'again',
  '2': 'hard',
  '3': 'good',
  '4': 'easy',
}

const ORDER: Grade[] = ['again', 'hard', 'good', 'easy']

export function Review() {
  const session = useStore((state) => state.session)
  const map = useStore((state) => state.map)
  const store = useStore

  useEffect(() => {
    if (!session) return
    const onKey = (event: KeyboardEvent) => {
      const state = store.getState()
      const current = state.session
      if (!current) return
      if (event.key === 'Escape') {
        state.exitReview()
        return
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (!current.revealed) state.reveal()
        return
      }
      const grade = KEYS[event.key]
      if (grade && current.revealed) {
        event.preventDefault()
        state.grade(grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session, store])

  if (!session || !map) return null

  const card = session.cards[session.index]
  if (!card) return null

  return (
    <div className="review-backdrop" role="dialog" aria-modal="true">
      <div className="review">
        <div className="review-head">
          <span className="review-scope">{session.scopeLabel}</span>
          <span className="review-count">
            {session.index + 1} / {session.cards.length}
            {session.free ? ' · repaso libre' : ''}
          </span>
          <button type="button" className="ghost" onClick={() => store.getState().exitReview()}>
            Salir (Esc)
          </button>
        </div>

        <div className="review-progress">
          <span style={{ width: `${((session.index + (session.revealed ? 1 : 0)) / session.cards.length) * 100}%` }} />
        </div>

        <div className="review-path">
          {card.path.map((id) => map.nodes[id]?.text).filter(Boolean).join(' / ')}
        </div>

        <div className="review-front">{card.front}</div>

        {session.revealed ? (
          <>
            <div className="review-back">{card.back}</div>
            <div className="review-actions">
              {ORDER.map((grade, index) => (
                <button
                  key={grade}
                  type="button"
                  className={`grade ${grade}`}
                  onClick={() => store.getState().grade(grade)}
                >
                  <span>{GRADE_LABELS[grade]}</span>
                  <kbd>{index + 1}</kbd>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="review-actions">
            <button type="button" className="primary wide" onClick={() => store.getState().reveal()}>
              Mostrar respuesta <kbd>espacio</kbd>
            </button>
          </div>
        )}

        <button
          type="button"
          className="review-jump"
          onClick={() => store.getState().goToNode(card.nodeId)}
        >
          Ver este nodo en el mapa
        </button>
      </div>
    </div>
  )
}
