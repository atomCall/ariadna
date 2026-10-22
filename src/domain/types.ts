export type NodeId = string

export interface MindNode {
  id: NodeId
  parentId: NodeId | null
  text: string
  note: string
  color: string | null
  collapsed: boolean
}

export interface MindMap {
  id: string
  title: string
  rootId: NodeId
  nodes: Record<NodeId, MindNode>
  order: Record<NodeId, NodeId[]>
  createdAt: number
  updatedAt: number
}

export type CardKind = 'children' | 'cloze'

export interface Card {
  id: string
  nodeId: NodeId
  kind: CardKind
  front: string
  back: string
  path: NodeId[]
}
