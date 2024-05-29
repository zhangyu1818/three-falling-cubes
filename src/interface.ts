/**
 * Worker
 */
export type WorkerMessageType = 'init' | 'step' | 'add'

export interface WorkerMessageData<T> {
  type: WorkerMessageType
  payload: T
}

export interface InitData {
  plane: {
    width: number
    height: number
  }
  cube: {
    width: number
    height: number
    depth: number
  }
}

export interface StepData {
  deltaTime: number
}

export interface AddData {
  id: string
  force: number
  position: [number, number, number]
}

/**
 * Main
 */

export type MainEventTypes = 'sync' | 'remove'

export interface MainEvent<T> {
  type: MainEventTypes
  payload: T
}

export interface SyncData {
  bodies: {
    id: string
    position: [number, number, number]
    quaternion: [number, number, number, number]
  }[]
}

export interface RemoveData {
  id: string
}
