import { create } from 'zustand'
import { db, reviewKey, type MapRow } from '../db/db'
import type { Card, MindMap, NodeId } from '../domain/types'
import * as tree from '../domain/tree'
import { cardsForSubtree, deriveCards } from '../domain/cards'
import { parseOutline } from '../domain/markdown'
import {
  emptyRecord,
  isDue,
  rate as rateCard,
  type Grade,
  type ReviewRecord,
} from '../domain/scheduler'

export interface ReviewSession {
  cards: Card[]
  index: number
  revealed: boolean
  free: boolean
  scopeLabel: string
  graded: Record<Grade, number>
}

interface State {
  ready: boolean
  map: MindMap | null
  list: MapRow[]
  selectedId: NodeId | null
  editingId: NodeId | null
  past: MindMap[]
  future: MindMap[]
  reviews: Record<string, ReviewRecord>
  session: ReviewSession | null
  heat: boolean
  notice: string | null

  load: () => Promise<void>
  apply: (next: MindMap, remember?: boolean) => void
  undo: () => void
  redo: () => void

  newMap: (title?: string) => Promise<void>
  openMap: (id: string) => Promise<void>
  renameMap: (title: string) => void
  select: (id: NodeId | null) => void
  startEditing: (id: NodeId) => void
  stopEditing: () => void
  addChild: () => void
  addSibling: () => void
  renameNode: (id: NodeId, text: string) => void
  removeNode: (id: NodeId) => void
  toggleCollapsed: (id: NodeId) => void
  setColor: (id: NodeId, color: string | null) => void
  reorder: (id: NodeId, delta: number) => void
  indent: (id: NodeId) => void
  outdent: (id: NodeId) => void
  setNote: (id: NodeId, note: string) => void
  importMarkdown: (text: string) => void
  toggleHeat: () => void
  notify: (message: string | null) => void

  startReview: (scopeId?: NodeId) => void
  reveal: () => void
  grade: (grade: Grade) => void
  exitReview: () => void
  goToNode: (id: NodeId) => void
  saveReviews: () => Promise<void>
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

function persist(doc: MindMap) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void db.maps.put({
      id: doc.id,
      title: doc.title,
      updatedAt: doc.updatedAt,
      doc,
    })
  }, 250)
}

function withRow(list: MapRow[], doc: MindMap): MapRow[] {
  const row: MapRow = { id: doc.id, title: doc.title, updatedAt: doc.updatedAt, doc }
  const rest = list.filter((item) => item.id !== doc.id)
  return [row, ...rest]
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  map: null,
  list: [],
  selectedId: null,
  editingId: null,
  past: [],
  future: [],
  reviews: {},
  session: null,
  heat: false,
  notice: null,

  load: async () => {
    const rows = await db.maps.orderBy('updatedAt').reverse().toArray()
    if (rows.length === 0) {
      const doc = tree.createMap()
      await db.maps.put({ id: doc.id, title: doc.title, updatedAt: doc.updatedAt, doc })
      set({
        ready: true,
        map: doc,
        list: [rows[0] ?? { id: doc.id, title: doc.title, updatedAt: doc.updatedAt, doc }],
        selectedId: doc.rootId,
      })
      return
    }
    const doc = rows[0].doc
    const reviewRows = await db.reviews.where('mapId').equals(doc.id).toArray()
    const reviews: Record<string, ReviewRecord> = {}
    for (const row of reviewRows) reviews[row.cardId] = row.record
    set({ ready: true, map: doc, list: rows, reviews, selectedId: doc.rootId })
  },

  apply: (next, remember = true) => {
    const current = get().map
    if (!current || current === next) return
    set({
      map: next,
      list: withRow(get().list, next),
      past: remember ? [...get().past.slice(-59), current] : get().past,
      future: remember ? [] : get().future,
    })
    persist(next)
  },

  undo: () => {
    const { past, map } = get()
    if (!map || past.length === 0) return
    const previous = past[past.length - 1]
    set({
      map: previous,
      past: past.slice(0, -1),
      future: [map, ...get().future],
      list: withRow(get().list, previous),
      selectedId:
        get().selectedId && previous.nodes[get().selectedId as string]
          ? get().selectedId
          : previous.rootId,
    })
    persist(previous)
  },

  redo: () => {
    const { future, map } = get()
    if (!map || future.length === 0) return
    const next = future[0]
    set({
      map: next,
      future: future.slice(1),
      past: [...get().past, map],
      list: withRow(get().list, next),
    })
    persist(next)
  },

  newMap: async (title = 'Mapa sin título') => {
    const doc = tree.createMap(title)
    await db.maps.put({ id: doc.id, title: doc.title, updatedAt: doc.updatedAt, doc })
    set({
      map: doc,
      list: [{ id: doc.id, title: doc.title, updatedAt: doc.updatedAt, doc }, ...get().list],
      selectedId: doc.rootId,
      editingId: null,
      past: [],
      future: [],
      reviews: {},
      session: null,
    })
  },

  openMap: async (id) => {
    const row = get().list.find((item) => item.id === id) ?? (await db.maps.get(id))
    if (!row) return
    const reviewRows = await db.reviews.where('mapId').equals(id).toArray()
    const reviews: Record<string, ReviewRecord> = {}
    for (const item of reviewRows) reviews[item.cardId] = item.record
    set({
      map: row.doc,
      selectedId: row.doc.rootId,
      editingId: null,
      past: [],
      future: [],
      reviews,
      session: null,
      list: withRow(get().list, row.doc),
    })
  },

  renameMap: (title) => {
    const map = get().map
    if (!map) return
    get().apply({ ...map, title, updatedAt: Date.now() })
  },

  select: (id) => set({ selectedId: id }),
  startEditing: (id) => set({ selectedId: id, editingId: id }),
  stopEditing: () => set({ editingId: null }),

  addChild: () => {
    const { map, selectedId } = get()
    if (!map) return
    const parentId = selectedId && map.nodes[selectedId] ? selectedId : map.rootId
    const result = tree.addChild(map, parentId)
    get().apply(result.map)
    set({ selectedId: result.id, editingId: result.id })
  },

  addSibling: () => {
    const { map, selectedId } = get()
    if (!map) return
    const anchor = selectedId ?? map.rootId
    const result = tree.addSibling(map, anchor)
    get().apply(result.map)
    set({ selectedId: result.id, editingId: result.id })
  },

  renameNode: (id, text) => {
    const map = get().map
    if (!map) return
    get().apply(tree.renameNode(map, id, text.trim().length > 0 ? text : 'Sin título'))
  },

  removeNode: (id) => {
    const map = get().map
    if (!map || id === map.rootId) return
    const parentId = map.nodes[id]?.parentId ?? map.rootId
    get().apply(tree.removeNode(map, id))
    set({ selectedId: parentId })
  },

  toggleCollapsed: (id) => {
    const map = get().map
    if (!map) return
    get().apply(tree.toggleCollapsed(map, id))
  },

  setColor: (id, color) => {
    const map = get().map
    if (!map) return
    get().apply(tree.setColor(map, id, color))
  },

  reorder: (id, delta) => {
    const map = get().map
    if (!map) return
    get().apply(tree.reorderSibling(map, id, delta))
  },

  indent: (id) => {
    const map = get().map
    if (!map) return
    get().apply(tree.indentNode(map, id))
  },

  outdent: (id) => {
    const map = get().map
    if (!map) return
    get().apply(tree.outdentNode(map, id))
  },

  setNote: (id, note) => {
    const map = get().map
    if (!map) return
    get().apply(tree.setNote(map, id, note))
  },

  importMarkdown: (text) => {
    const current = get().map
    const parsed = parseOutline(text)
    const doc: MindMap = { ...parsed, id: current?.id ?? parsed.id }
    get().apply(doc)
    set({
      selectedId: doc.rootId,
      editingId: null,
      list: withRow(get().list, doc),
    })
    void db.maps.put({ id: doc.id, title: doc.title, updatedAt: doc.updatedAt, doc })
    get().notify(`Mapa importado: ${tree.countNodes(doc)} nodos.`)
  },

  toggleHeat: () => set({ heat: !get().heat }),
  notify: (message) => set({ notice: message }),

  startReview: (scopeId) => {
    const { map, reviews } = get()
    if (!map) return
    const all = scopeId ? cardsForSubtree(map, scopeId) : deriveCards(map)
    if (all.length === 0) {
      get().notify(
        'Este mapa no tiene tarjetas todavía. Añade hijos a un nodo o escribe {{huecos}} en una nota.',
      )
      return
    }
    const due = all.filter((card) => isDue(reviews[card.id]))
    const free = due.length === 0
    const sorted = [...(free ? all : due)].sort((a, b) => {
      const left = reviews[a.id]
        ? new Date(reviews[a.id].card.due).getTime()
        : Number.MAX_SAFE_INTEGER
      const right = reviews[b.id]
        ? new Date(reviews[b.id].card.due).getTime()
        : Number.MAX_SAFE_INTEGER
      return left - right
    })
    const cards = sorted.slice(0, 60)
    const scopeLabel = scopeId
      ? tree.pathTo(map, scopeId).map((node) => node.text).join(' / ')
      : map.title
    set({
      session: {
        cards,
        index: 0,
        revealed: false,
        free,
        scopeLabel,
        graded: { again: 0, hard: 0, good: 0, easy: 0 },
      },
      selectedId: null,
      editingId: null,
    })
  },

  reveal: () => {
    const session = get().session
    if (!session) return
    set({ session: { ...session, revealed: true } })
  },

  grade: (grade) => {
    const { map, session, reviews } = get()
    if (!map || !session) return
    const card = session.cards[session.index]
    if (!card) return
    const record = rateCard(reviews[card.id] ?? emptyRecord(), grade)
    const nextReviews = { ...reviews, [card.id]: record }
    void db.reviews.put({
      key: reviewKey(map.id, card.id),
      mapId: map.id,
      cardId: card.id,
      record,
    })
    const graded = { ...session.graded, [grade]: session.graded[grade] + 1 }
    const index = session.index + 1
    if (index >= session.cards.length) {
      set({
        reviews: nextReviews,
        session: null,
        notice: `Sesión terminada: ${session.cards.length} tarjetas repasadas.`,
      })
      return
    }
    set({ reviews: nextReviews, session: { ...session, index, revealed: false, graded } })
  },

  exitReview: () => set({ session: null }),

  goToNode: (id) => {
    const map = get().map
    if (!map) return
    get().apply(tree.expandAncestors(map, id), false)
    set({ session: null, selectedId: id, editingId: null })
  },

  saveReviews: async () => {
    const { map, reviews } = get()
    if (!map) return
    await db.reviews.bulkPut(
      Object.entries(reviews).map(([cardId, record]) => ({
        key: reviewKey(map.id, cardId),
        mapId: map.id,
        cardId,
        record,
      })),
    )
  },
}))

