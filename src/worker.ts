import type {
  WorkerMessageData,
  InitData,
  StepData,
  AddData,
} from './interface.ts'

// @ts-ignore
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat'

RAPIER.init().then(() => {
  const world = new RAPIER.World({ x: 0, y: -9.82, z: 0 })

  let cubeColliderDesc = RAPIER.ColliderDesc.cuboid(1, 1, 1)

  const bodiesMap = new Map<any, number>()
  const needRemoveIds = new Set<number>()

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

    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(
      width / 2,
      0,
      height / 2,
    )
    world.createCollider(groundColliderDesc)

    cubeColliderDesc = RAPIER.ColliderDesc.cuboid(
      cube.width / 2,
      cube.height / 2,
      cube.depth / 2,
    )
  }

  const addBody = ({ id, force, position }: AddData) => {
    const cubeBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
      ...position,
    )

    const cubeBody = world.createRigidBody(cubeBodyDesc)
    world.createCollider(cubeColliderDesc, cubeBody)

    cubeBody.setLinvel({ x: 0, y: force, z: 0 }, true)

    bodiesMap.set(cubeBody, id)
  }

  const removeBody = (body: any) => {
    if (body) {
      const id = bodiesMap.get(body)
      if (id) {
        needRemoveIds.add(id)
      }
      bodiesMap.delete(body)
      world.removeRigidBody(body)
    }
  }

  const step = () => {
    world.step()

    const len = world.bodies.len()

    const data = new Float32Array(len * 8)

    let i = 0
    for (const [body, id] of bodiesMap.entries()) {
      const position = body.translation()
      const rotation = body.rotation()
      if (position.y < -50) {
        removeBody(body)
        needRemoveIds.add(id)
        continue
      }

      const index = i * 8

      data[index] = id

      data[index + 1] = position.x
      data[index + 2] = position.y
      data[index + 3] = position.z

      data[index + 4] = rotation.x
      data[index + 5] = rotation.y
      data[index + 6] = rotation.z
      data[index + 7] = rotation.w

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
  }, 1000)

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

  // Loaded
  self.postMessage({
    type: 'loaded',
  })
})
