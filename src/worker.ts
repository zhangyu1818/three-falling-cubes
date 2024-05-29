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
let needRemoveIds = new Set<number>()

const bodiesMap = new Map<CANNON.Body, number>()

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
  bodiesMap.delete(body)

  queueMicrotask(() => {
    if (body) {
      body.shapes = []
      body.material = null

      world.removeBody(body)
    }
  })
}
let lastTime: number | null = null
const step = () => {
  if (lastTime === null) {
    lastTime = performance.now()
  }
  const deltaTime = performance.now() - lastTime
  lastTime = performance.now()
  world.fixedStep(1 / 60, deltaTime)

  const len = world.bodies.length

  const data = new Float32Array(len * 8)

  let i = 0
  for (const [body, id] of bodiesMap.entries()) {
    if (body.position.y < -50) {
      removeBody(body)
      needRemoveIds.add(id)
      continue
    }

    const index = i * 8

    data[index] = id

    data[index + 1] = body.position.x
    data[index + 2] = body.position.y
    data[index + 3] = body.position.z

    data[index + 4] = body.quaternion.x
    data[index + 5] = body.quaternion.y
    data[index + 6] = body.quaternion.z
    data[index + 7] = body.quaternion.w

    i++
  }

  self.postMessage(
    {
      type: 'sync',
      payload: {
        data,
      },
    },
    // @ts-expect-error
    [data.buffer],
  )

  requestAnimationFrame(step)
}

const onSleep = (event: Event) => {
  const body = event.target as unknown as CANNON.Body
  body.removeEventListener('sleep', onSleep)

  const id = bodiesMap.get(body)

  removeBody(body)

  if (id) {
    needRemoveIds.add(id)
  }
}

const postMessageToRemoveMesh = (id: number[]) => {
  self.postMessage({
    type: 'remove',
    payload: {
      id,
    },
  })
}

/**
 * Dirty Check
 */
setInterval(() => {
  if (needRemoveIds.size > 0) {
    postMessageToRemoveMesh([...needRemoveIds])
    needRemoveIds.clear()
  }
}, 2000)

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
    step()
  }
})
