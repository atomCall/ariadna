import { createEmptyCard, fsrs, generatorParameters, Rating, type Card } from 'ts-fsrs'

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export interface StoredCard {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: string
}

export interface ReviewEntry {
  at: number
  grade: Grade
  days: number
}

export interface ReviewRecord {
  card: StoredCard
  history: ReviewEntry[]
}

const scheduler = fsrs(
  generatorParameters({
    enable_fuzz: true,
    enable_short_term: true,
    request_retention: 0.9,
  }),
)

const GRADES = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const

export const GRADE_LABELS: Record<Grade, string> = {
  again: 'Otra vez',
  hard: 'Difícil',
  good: 'Bien',
  easy: 'Fácil',
}

function serialize(card: Card): StoredCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : undefined,
  }
}

function deserialize(card: StoredCard): Card {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  }
}

export function emptyRecord(): ReviewRecord {
  return { card: serialize(createEmptyCard(new Date())), history: [] }
}

export function rate(
  record: ReviewRecord,
  grade: Grade,
  now: number = Date.now(),
): ReviewRecord {
  const result = scheduler.next(deserialize(record.card), new Date(now), GRADES[grade])
  const days = Math.max(
    0,
    Math.round((result.card.due.getTime() - now) / (24 * 60 * 60 * 1000)),
  )
  return {
    card: serialize(result.card),
    history: [...record.history, { at: now, grade, days }],
  }
}

export function isNew(record: ReviewRecord | undefined): boolean {
  return !record || record.card.reps === 0
}

export function isDue(record: ReviewRecord | undefined, now: number = Date.now()): boolean {
  if (!record) return true
  return new Date(record.card.due).getTime() <= now
}

export function retention(record: ReviewRecord | undefined): number | null {
  if (!record || record.history.length === 0) return null
  const score = { again: 0, hard: 0.4, good: 0.8, easy: 1 } as const
  const total = record.history.reduce((sum, entry) => sum + score[entry.grade], 0)
  return total / record.history.length
}

export function nextDueLabel(record: ReviewRecord | undefined): string {
  if (!record || record.card.reps === 0) return 'sin empezar'
  const days = Math.round(
    (new Date(record.card.due).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  )
  if (days <= 0) return 'toca hoy'
  if (days === 1) return 'mañana'
  if (days < 30) return `en ${days} días`
  const months = Math.round(days / 30)
  return months <= 1 ? 'en un mes' : `en ${months} meses`
}
