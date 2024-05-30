import './style.css'

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Timer } from 'three/addons/misc/Timer.js'
import { type RigidBody } from '@dimforge/rapier3d'
import { Pane } from 'tweakpane'
import * as Essentials from '@tweakpane/plugin-essentials'

import('@dimforge/rapier3d').then((RAPIER) => {
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
    new THREE.MeshLambertMaterial({ color: 0xf87171 }),
    new THREE.MeshLambertMaterial({ color: 0xfde047 }),
    new THREE.MeshLambertMaterial({ color: 0xa78bfa }),
    new THREE.MeshLambertMaterial({ color: 0xf472b6 }),
    new THREE.MeshLambertMaterial({ color: 0x34d399 }),
    new THREE.MeshLambertMaterial({ color: 0x8b5cf6 }),
  ]

  const planeMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(planeSize.width, planeSize.height),
    new THREE.MeshLambertMaterial({
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
   * Physics
   */
  const world = new RAPIER.World({ x: 0, y: -9.82, z: 0 })

  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0, 10.0)
  world.createCollider(groundColliderDesc)

  const cubeColliderDesc = RAPIER.ColliderDesc.cuboid(
    cubeSize.width / 2,
    cubeSize.height / 2,
    cubeSize.depth / 2,
  )

  const cubeBodies = new Set<RigidBody>()
  const bodyMeshMap = new WeakMap<RigidBody, THREE.Mesh>()

  /**
   * Functions
   */
  const removeCubeBody = (cubeBody: RigidBody) => {
    if (cubeBody) {
      cubeBodies.delete(cubeBody)
      world.removeRigidBody(cubeBody)

      const mesh = bodyMeshMap.get(cubeBody)
      if (mesh) {
        scene.remove(mesh)
        bodyMeshMap.delete(cubeBody)
      }
    }
  }

  const syncMeshWithBody = () => {
    cubeBodies.forEach((cubeBody) => {
      const position = cubeBody.translation()
      const rotation = cubeBody.rotation()

      if (position.y < -50 || cubeBody.isSleeping()) {
        removeCubeBody(cubeBody)
        return
      }

      const cubeMesh = bodyMeshMap.get(cubeBody)

      if (cubeMesh) {
        cubeMesh.position.copy(position)
        cubeMesh.quaternion.copy(rotation)
      }
    })
  }

  const createCubeMeshWithPhysics = (position: THREE.Vector3) => {
    const cubeBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
      position.x,
      position.y,
      position.z,
    )

    const cubeBody = world.createRigidBody(cubeBodyDesc)

    world.createCollider(cubeColliderDesc, cubeBody)

    cubeBody.setLinvel({ x: 0, y: initialInfo.force, z: 0 }, true)

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
   * rAF
   */
  const timer = new Timer()
  const tick = (timestamp: number) => {
    fpsGraph.begin()

    requestAnimationFrame(tick)

    timer.update(timestamp)

    world.step()

    syncMeshWithBody()

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
})
