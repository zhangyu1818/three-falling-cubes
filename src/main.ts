import './style.css'

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Timer } from 'three/addons/misc/Timer.js'

import * as CANNON from 'cannon-es'
import CannonDebugger from 'cannon-es-debugger'

import { Pane } from 'tweakpane'

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
  cannonDebugEnable: false,
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
  time: 50,
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

camera.position.x = -5
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
 * Physics
 */
const world = new CANNON.World()
world.gravity.set(0, -9.82, 0)
world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true

const planeShape = new CANNON.Box(
  new CANNON.Vec3(planeSize.width / 2, 1, planeSize.height / 2),
)
const planeBody = new CANNON.Body({
  mass: 0,
  // 0.05 to avoid z-fighting
  position: new CANNON.Vec3(0, -1 + 0.05, 0),
})
planeBody.addShape(planeShape)

world.addBody(planeBody)

const cubeBodies = new Set<CANNON.Body>()
const bodyMeshMap = new WeakMap<CANNON.Body, THREE.Mesh>()

const cubeShape = new CANNON.Box(
  new CANNON.Vec3(cubeSize.width / 2, cubeSize.height / 2, cubeSize.depth / 2),
)

/**
 * Functions
 */
const removeCubeBody = (cubeBody: CANNON.Body) => {
  cubeBody.removeEventListener('sleep', onSleep)

  queueMicrotask(() => {
    if (cubeBody) {
      cubeBodies.delete(cubeBody)
      world.removeBody(cubeBody)

      cubeBody.shapes = []
      cubeBody.material = null

      const mesh = bodyMeshMap.get(cubeBody)
      if (mesh) {
        scene.remove(mesh)
        bodyMeshMap.delete(cubeBody)
      }
    }
  })
}

const onSleep = (event: Event) => {
  const target = event.target as unknown as CANNON.Body
  removeCubeBody(target)
}

const syncMeshWithBody = () => {
  cubeBodies.forEach((cubeBody) => {
    const cubeMesh = bodyMeshMap.get(cubeBody)

    if (cubeMesh) {
      cubeMesh.position.copy(cubeBody.position)
      cubeMesh.quaternion.copy(cubeBody.quaternion)
    }

    if (cubeBody.position.y < -50) {
      removeCubeBody(cubeBody)
    }
  })
}

const createCubeMeshWithPhysics = (position: THREE.Vector3) => {
  const cubeBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(position.x, position.y, position.z),
    quaternion: new CANNON.Quaternion().setFromAxisAngle(
      new CANNON.Vec3(Math.random(), Math.random(), Math.random()).unit(),
      Math.random() * Math.PI,
    ),
  })
  cubeBody.addShape(cubeShape)

  cubeBody.velocity.set(0, initialInfo.force, 0)

  cubeBody.addEventListener('sleep', onSleep)

  world.addBody(cubeBody)

  cubeBodies.add(cubeBody)

  const cubeMesh = new THREE.Mesh(
    cubeGeometry,
    cubeMaterials[Math.floor(Math.random() * cubeMaterials.length)],
  )

  cubeMesh.position.copy(position)
  cubeMesh.castShadow = true

  scene.add(cubeMesh)

  bodyMeshMap.set(cubeBody, cubeMesh)
}

/**
 * Debug
 */
// @ts-expect-error
const cannonDebugger = new CannonDebugger(scene, world)

/**
 * rAF
 */
const timer = new Timer()
const tick = (timestamp: number) => {
  requestAnimationFrame(tick)

  timer.update(timestamp)

  const deltaTime = timer.getDelta()

  world.step(1 / 60, deltaTime, 3)

  syncMeshWithBody()

  orbitControls.update()

  if (debug.cannonDebugEnable) {
    cannonDebugger.update()
  }

  renderer.render(scene, camera)
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
      const offsetX = Math.random() - 0.5
      const offsetZ = Math.random() - 0.5
      createCubeMeshWithPhysics(
        new THREE.Vector3(
          initialInfo.x + offsetX + offsetX < 0 ? -i : i,
          initialInfo.y + Math.random() * 2,
          initialInfo.z + offsetZ + offsetZ < 0 ? -i : i,
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

debugFolder.addBinding(debug, 'cannonDebugEnable', {
  label: 'Cannon Debug Enable',
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
