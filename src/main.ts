import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { Pane } from 'tweakpane'
import * as Essentials from '@tweakpane/plugin-essentials'

import PhysicalWorker from './worker?worker'

import type { MainEvent, SyncData, RemoveData } from './interface'

import './style.css'

const worker = new PhysicalWorker()

const scene = new THREE.Scene()

const planeSize = {
  width: 25,
  height: 25,
}

const cubeSize = {
  width: 1,
  height: 1,
  depth: 1,
}

const debug = {
  shadowCameraHelperEnable: false,
}

const initialInfo = {
  x: 0,
  y: 15,
  z: 0,
  force: -20,
  flow: 1,
}

const interval = {
  time: 1000,
}

/**
 * Mesh
 */
const cubeGeometry = new THREE.BoxGeometry(
  cubeSize.width,
  cubeSize.height,
  cubeSize.depth,
)

const cubeMaterials = [
  new THREE.MeshStandardMaterial({ color: 0xf87171 }),
  new THREE.MeshStandardMaterial({ color: 0xfde047 }),
  new THREE.MeshStandardMaterial({ color: 0xa78bfa }),
  new THREE.MeshStandardMaterial({ color: 0xf472b6 }),
  new THREE.MeshStandardMaterial({ color: 0x34d399 }),
  new THREE.MeshStandardMaterial({ color: 0x8b5cf6 }),
]

const planeMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(planeSize.width, planeSize.height),
  new THREE.MeshStandardMaterial({
    color: 0x60a5fa,
    side: THREE.DoubleSide,
  }),
)
planeMesh.rotation.x = -Math.PI / 2
planeMesh.receiveShadow = true

scene.add(planeMesh)

/**
 * Light
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 1)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 2)
directionalLight.position.set(0, 15, 5)

directionalLight.castShadow = true
directionalLight.shadow.camera.near = 0.5
directionalLight.shadow.camera.far = 20
directionalLight.shadow.camera.top = 15
directionalLight.shadow.camera.right = 15
directionalLight.shadow.camera.bottom = -15
directionalLight.shadow.camera.left = -15

scene.add(directionalLight)

/**
 * Renderer
 */

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.BasicShadowMap
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(innerWidth, innerHeight)

document.body.appendChild(renderer.domElement)

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight)

camera.position.x = -20
camera.position.y = 20
camera.position.z = -40

scene.add(camera)

const orbitControls = new OrbitControls(camera, renderer.domElement)
orbitControls.enableDamping = true
orbitControls.enablePan = false

const directionalLightCameraHelper = new THREE.CameraHelper(
  directionalLight.shadow.camera,
)

/**
 * Worker
 */
const bodyMeshMap = new Map<number, THREE.Mesh>()
let currentId = 1

const isSyncData = (data: unknown): data is MainEvent<SyncData> =>
  (data as MainEvent<unknown>).type === 'sync'

const isRemoveData = (data: unknown): data is MainEvent<RemoveData> =>
  (data as MainEvent<unknown>).type === 'remove'

const requestSynFromWorker = () => {
  worker.postMessage({
    type: 'step',
  })
}

worker.postMessage({
  type: 'init',
  payload: { plane: planeSize, cube: cubeSize },
})

worker.addEventListener('message', (event) => {
  const { data } = event
  if (isRemoveData(data)) {
    removeCubeMesh(data.payload)
  } else if (isSyncData(event.data)) {
    syncMesh(data.payload)
  }
})

/**
 * Functions
 */
const removeCubeMesh = ({ id }: RemoveData) => {
  for (const value of id) {
    const mesh = bodyMeshMap.get(value)
    if (mesh) {
      scene.remove(mesh)
    }
  }
}

const syncMesh = ({ data }: SyncData) => {
  const len = data.length / 8
  for (let i = 0; i < len; i++) {
    const index = i * 8
    const id = data[index]

    if (id === 0) {
      break
    }

    const position = new THREE.Vector3(
      data[index + 1],
      data[index + 2],
      data[index + 3],
    )
    const quaternion = new THREE.Quaternion(
      data[index + 4],
      data[index + 5],
      data[index + 6],
      data[index + 7],
    )

    const cubeMesh = bodyMeshMap.get(id)

    if (cubeMesh) {
      cubeMesh.position.copy(position)
      cubeMesh.quaternion.copy(quaternion)
    }
  }
}

const createCubeMeshWithPhysics = (position: THREE.Vector3) => {
  const id = currentId++

  worker.postMessage({
    type: 'add',
    payload: {
      id,
      force: initialInfo.force * Math.max(initialInfo.flow / 3, 1),
      position: [position.x, position.y, position.z],
    },
  })

  const cubeMesh = new THREE.Mesh(
    cubeGeometry,
    cubeMaterials[Math.floor(Math.random() * cubeMaterials.length)],
  )

  cubeMesh.position.copy(position)
  cubeMesh.castShadow = true

  scene.add(cubeMesh)

  bodyMeshMap.set(id, cubeMesh)
}

/**
 * rAF
 */
requestSynFromWorker()

const tick = () => {
  fpsGraph.begin()

  requestAnimationFrame(tick)

  orbitControls.update()

  renderer.render(scene, camera)

  fpsGraph.end()
}

requestAnimationFrame(tick)
/**
 * Create Cube
 */
let id: number

const createCube = () => {
  clearInterval(id)
  id = setInterval(() => {
    for (let i = 0; i < initialInfo.flow; i++) {
      const angle = Math.random() * 2 * Math.PI
      const r = (initialInfo.flow + 1) * Math.sqrt(Math.random())
      const offsetX = r * Math.cos(angle)
      const offsetZ = r * Math.sin(angle)

      createCubeMeshWithPhysics(
        new THREE.Vector3(
          initialInfo.x + offsetX,
          initialInfo.y + Math.random() * (2 + initialInfo.flow),
          initialInfo.z + offsetZ,
        ),
      )
    }
  }, interval.time)
}

createCube()

/**
 * Tweakpane
 */
const pane = new Pane()
pane.registerPlugin(Essentials)

pane
  .addBinding(interval, 'time', {
    label: 'Create Interval',
    min: 0,
    max: 1000,
    step: 50,
  })
  .on('change', (changed) => {
    if (changed) {
      createCube()
    }
  })

pane.addBinding(initialInfo, 'flow', {
  label: 'Create Flow',
  min: 1,
  max: 10,
  step: 1,
})

pane.addBinding({ initialInfo }, 'initialInfo', {
  label: 'Initial Position',
  x: {
    min: -10,
    max: 10,
    step: 1,
  },
  y: {
    min: 10,
    max: 50,
    step: 1,
  },
  z: {
    min: -10,
    max: 10,
    step: 1,
  },
})

pane.addBinding(initialInfo, 'force', {
  label: 'Initial Force',
  min: -50,
  max: 50,
  step: 1,
})

const shadowFolder = pane.addFolder({
  title: 'Shadow',
  expanded: false,
})

shadowFolder.addBinding(renderer.shadowMap, 'enabled', {
  label: 'Enable',
})

shadowFolder.addBinding(renderer.shadowMap, 'type', {
  label: 'Type',
  options: {
    BasicShadowMap: THREE.BasicShadowMap,
    PCFShadowMap: THREE.PCFShadowMap,
    PCFSoftShadowMap: THREE.PCFSoftShadowMap,
  },
})

shadowFolder
  .addBinding({ width: directionalLight.shadow.mapSize.width }, 'width', {
    label: 'Map Size',
    options: {
      128: 128,
      256: 256,
      512: 512,
      1024: 1024,
      2048: 2048,
      4096: 4096,
    },
  })
  .on('change', (changed) => {
    if (changed) {
      const value = changed.value
      directionalLight.shadow.mapSize.width = value
      directionalLight.shadow.mapSize.height = value
      directionalLight.shadow.map?.dispose()
      directionalLight.shadow.map = null
    }
  })

const debugFolder = pane.addFolder({
  title: 'Debug',
  expanded: false,
})

debugFolder
  .addBinding(debug, 'shadowCameraHelperEnable', {
    label: 'Shadow Camera Helper Enable',
  })
  .on('change', (changed) => {
    if (changed) {
      if (debug.shadowCameraHelperEnable) {
        scene.add(directionalLightCameraHelper)
      } else {
        scene.remove(directionalLightCameraHelper)
      }
    }
  })

pane.addBlade({
  view: 'separator',
})

const fpsGraph = pane.addBlade({
  view: 'fpsgraph',

  label: 'fpsgraph',
  rows: 2,
}) as Essentials.FpsGraphBladeApi
