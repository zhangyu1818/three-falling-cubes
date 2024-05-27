import './style.css'

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Timer } from 'three/addons/misc/Timer.js'

import * as CANNON from 'cannon-es'
import CannonDebugger from 'cannon-es-debugger'

const scene = new THREE.Scene()

const planeSize = {
  width: 10,
  height: 10,
}

const cubeSize = {
  width: 1,
  height: 1,
  depth: 1,
}

/**
 * Mesh
 */
const planeMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(planeSize.width, planeSize.height),
  new THREE.MeshStandardMaterial({
    color: 0x808080,
    side: THREE.DoubleSide,
  }),
)
planeMesh.rotation.x = -Math.PI / 2

scene.add(planeMesh)

/**
 * Light
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 1)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 2)
directionalLight.position.set(-5, 5, 5)
scene.add(directionalLight)

/**
 * Renderer
 */

const renderer = new THREE.WebGLRenderer()
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(innerWidth, innerHeight)

document.body.appendChild(renderer.domElement)

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(
  45,
  innerWidth / innerHeight,
  0.1,
  100,
)

camera.position.x = -5
camera.position.y = 5
camera.position.z = -12

scene.add(camera)

const orbitControls = new OrbitControls(camera, renderer.domElement)
orbitControls.enableDamping = true

/**
 * Physics
 */
const world = new CANNON.World()
world.gravity.set(0, -9.82, 0)

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

/**
 * Functions
 */
const syncMeshWithBody = () => {
  cubeBodies.forEach((cubeBody) => {
    const cubeMesh = bodyMeshMap.get(cubeBody)

    if (cubeMesh) {
      cubeMesh.position.copy(cubeBody.position)
      cubeMesh.quaternion.copy(cubeBody.quaternion)
    }
  })
}

const createCubeMeshWithPhysics = (position: THREE.Vector3) => {
  const cubeShape = new CANNON.Box(
    new CANNON.Vec3(
      cubeSize.width / 2,
      cubeSize.height / 2,
      cubeSize.depth / 2,
    ),
  )
  const cubeBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(position.x, position.y, position.z),
  })
  cubeBody.addShape(cubeShape)

  world.addBody(cubeBody)

  cubeBodies.add(cubeBody)

  const cubeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(cubeSize.width, cubeSize.height, cubeSize.depth),
    new THREE.MeshStandardMaterial({
      color: 0xff0000,
    }),
  )

  cubeMesh.position.copy(position)

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

  cannonDebugger.update()

  renderer.render(scene, camera)
}

requestAnimationFrame(tick)

setInterval(() => {
  createCubeMeshWithPhysics(new THREE.Vector3(0, 15, 0))
}, 100)
