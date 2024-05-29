import * as CANNON from 'cannon-es'

import type {
  WorkerMessageData,
  InitData,
  StepData,
  AddData,
} from './interface.ts'

const world = new CANNON.World()
world.gravity.set(0, -9.82, 0)
world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true

let cubeShape = new CANNON.Box(new CANNON.Vec3())

const bodiesMap = new Map<CANNON.Body, string>()

/**
 * Events
 */
const isInitEvent = (data: unknown): data is WorkerMessageData<InitData> =>
  (data as WorkerMessageData<unknown>).type === 'init'

const isStepEvent = (data: unknown): data is WorkerMessageData<StepData> =>
  (data as WorkerMessageData<unknown>).type === 'step'

const isAddEvent = (data: unknown): data is WorkerMessageData<AddData> =>
  (data as WorkerMessageData<unknown>).type === 'add'

/**
 * Functions
 */
const init = ({ plane, cube }: InitData) => {
  const { width, height } = plane

  const planeShape = new CANNON.Box(new CANNON.Vec3(width / 2, 1, height / 2))
  const planeBody = new CANNON.Body({
    mass: 0,
    // 0.05 to avoid z-fighting
    position: new CANNON.Vec3(0, -1 + 0.05, 0),
  })
  planeBody.addShape(planeShape)
  world.addBody(planeBody)

  cubeShape = new CANNON.Box(
    new CANNON.Vec3(cube.width / 2, cube.height / 2, cube.depth / 2),
  )
}

const addBody = ({ id, force, position }: AddData) => {
  const cubeBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(...position),
    quaternion: new CANNON.Quaternion().setFromAxisAngle(
      new CANNON.Vec3(Math.random(), Math.random(), Math.random()).unit(),
      Math.random() * Math.PI,
    ),
  })
  cubeBody.addShape(cubeShape)

  cubeBody.velocity.set(0, force, 0)

  cubeBody.addEventListener('sleep', onSleep)

  world.addBody(cubeBody)

  bodiesMap.set(cubeBody, id)
}

const removeBody = (body: CANNON.Body) => {
  queueMicrotask(() => {
    if (body) {
      body.shapes = []
      body.material = null

      world.removeBody(body)
      bodiesMap.delete(body)
    }
  })
}

const step = ({ deltaTime }: StepData) => {
  world.step(1 / 60, deltaTime)

  self.postMessage({
    type: 'sync',
    payload: {
      bodies: Array.from(bodiesMap.entries()).map(([body, id]) => {
        if (body.position.y < -50) {
          removeBody(body)
          postMessageToRemoveMesh(id)
        }

        return {
          id,
          position: [body.position.x, body.position.y, body.position.z],
          quaternion: [
            body.quaternion.x,
            body.quaternion.y,
            body.quaternion.z,
            body.quaternion.w,
          ],
        }
      }),
    },
  })
}

const onSleep = (event: Event) => {
  const body = event.target as unknown as CANNON.Body
  body.removeEventListener('sleep', onSleep)

  removeBody(body)

  const id = bodiesMap.get(body)
  if (id) {
    postMessageToRemoveMesh(id)
  }
}

const postMessageToRemoveMesh = (id: string) => {
  self.postMessage({
    type: 'remove',
    payload: {
      id,
    },
  })
}

/**
 * Message Event
 */
self.addEventListener('message', (event) => {
  const { data } = event
  if (isInitEvent(data)) {
    init(data.payload)
  } else if (isAddEvent(data)) {
    addBody(data.payload)
  } else if (isStepEvent(data)) {
    step(data.payload)
  }
})
