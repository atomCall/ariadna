import Dexie, { type Table } from 'dexie'
import type { MindMap } from '../domain/types'
import type { ReviewRecord } from '../domain/scheduler'

export interface MapRow {
  id: string
  title: string
  updatedAt: number
  doc: MindMap
}

export interface ReviewRow {
  key: string
  mapId: string
  cardId: string
  record: ReviewRecord
}

class AriadnaDB extends Dexie {
  maps!: Table<MapRow, string>
  reviews!: Table<ReviewRow, string>

  constructor() {
    super('ariadna')
    this.version(1).stores({
      maps: 'id, updatedAt',
      reviews: 'key, mapId',
    })
  }
}

export const db = new AriadnaDB()

export function reviewKey(mapId: string, cardId: string): string {
  return `${mapId}|${cardId}`
}
