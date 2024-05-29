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

export interface StepData {}

export interface AddData {
  id: number
  force: number
  position: [number, number, number]
}

/**
 * Main
 */

export type MainEventTypes = 'sync' | 'remove' | 'stop' | 'continue'

export interface MainEvent<T> {
  type: MainEventTypes
  payload: T
}

export interface SyncData {
  data: Float32Array
}

export interface RemoveData {
  id: number[]
}
