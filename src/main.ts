import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';

/**
 * 4D Wave Simulation
 * 
 * This application visualizes a 4D wave effect projected into 3D space.
 * Points rotate in both XY and ZW planes simultaneously, creating a mesmerizing
 * hyperdimensional effect when projected down to 3D.
 */

// ============================================================================
// Global State & Parameters
// ============================================================================

interface SimulationParams {
  rotationSpeedXY: number;
  rotationSpeedZW: number;
  particleSize: number;
  spread: number;
  colorIntensity: number;
  colorAnimationSpeed: number;
  timeScale: number;
  projectionFactor: number;
  sharpness: number;
  glowIntensity: number;
  blendFactor: number;
  opacity: number;
  blendingMode: string;
  depthWrite: boolean;
}

const params: SimulationParams = {
  rotationSpeedXY: 0.5,
  rotationSpeedZW: 0.3,
  particleSize: 3.0,
  spread: 5.0,
  colorIntensity: 1.0,
  colorAnimationSpeed: 0.5,
  timeScale: 1.0,
  projectionFactor: 0.5,
  sharpness: 0.3,
  glowIntensity: 1.0,
  blendFactor: 1.0,
  opacity: 1.0,
  blendingMode: 'Additive',
  depthWrite: false
};

// ============================================================================
// Shader Code
// ============================================================================

const vertexShader = `
  // 4D position attribute (x, y, z, w)
  attribute vec4 position4D;
  
  // Uniforms for animation and rotation
  uniform float time;
  uniform float angleXY;
  uniform float angleZW;
  uniform float spread;
  uniform float projectionFactor;
  uniform float colorAnimationSpeed;
  
  // Varying to pass color to fragment shader
  varying vec3 vColor;
  varying float vIntensity;
  
  // 4D Rotation in XY plane
  vec4 rotateXY(vec4 pos, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec4(
      c * pos.x - s * pos.y,
      s * pos.x + c * pos.y,
      pos.z,
      pos.w
    );
  }
  
  // 4D Rotation in ZW plane
  vec4 rotateZW(vec4 pos, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec4(
      pos.x,
      pos.y,
      c * pos.z - s * pos.w,
      s * pos.z + c * pos.w
    );
  }
  
  void main() {
    // Start with 4D position
    vec4 pos4D = position4D * spread;
    
    // Apply 4D rotations using accumulated angles
    pos4D = rotateXY(pos4D, angleXY);
    pos4D = rotateZW(pos4D, angleZW);
    
    // Project from 4D to 3D using perspective projection
    // The further away in the 4th dimension, the smaller it appears
    float wFactor = 1.0 + pos4D.w * projectionFactor;
    vec3 pos3D = pos4D.xyz / wFactor;
    
    // Calculate color based on 4D position with independent animation speed
    // Map 4D coordinates to RGB
    float colorTime = time * colorAnimationSpeed;
    vColor = vec3(
      0.5 + 0.5 * sin(pos4D.x * 0.5 + colorTime * 0.5),
      0.5 + 0.5 * sin(pos4D.y * 0.5 + colorTime * 0.3),
      0.5 + 0.5 * sin(pos4D.w * 0.5 + colorTime * 0.7)
    );
    
    // Calculate intensity based on distance from origin in 4D
    float dist4D = length(pos4D);
    vIntensity = 0.5 + 0.5 * sin(dist4D * 0.3 - colorTime);
    
    // Standard Three.js transformation
    vec4 mvPosition = modelViewMatrix * vec4(pos3D, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Point size based on distance (closer = bigger)
    gl_PointSize = 300.0 / -mvPosition.z;
  }
`;

const fragmentShader = `
  uniform float colorIntensity;
  uniform float particleSize;
  uniform float sharpness;
  uniform float glowIntensity;
  uniform float blendFactor;
  uniform float opacity;
  
  varying vec3 vColor;
  varying float vIntensity;
  
  void main() {
    // Create circular points (not squares)
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    
    // Soft edge falloff with dynamic sharpness
    // sharpness: 0 = very blurry (0.1 to 0.5), 1 = sharp (0.45 to 0.5)
    float innerRadius = mix(0.1, 0.45, sharpness);
    float alpha = 1.0 - smoothstep(innerRadius, 0.5, dist);
    
    // Apply color with intensity modulation
    vec3 finalColor = vColor * colorIntensity * vIntensity;
    
    // Add glow effect with controllable intensity
    finalColor += vec3(0.2, 0.2, 0.3) * (1.0 - dist * 2.0) * glowIntensity;
    
    // Apply blend factor and opacity to simulate blend mode interpolation
    gl_FragColor = vec4(finalColor, alpha * blendFactor * opacity);
  }
`;

// ============================================================================
// Scene Setup
// ============================================================================

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let points: THREE.Points;
let material: THREE.ShaderMaterial;
let gui: GUI;
let time = 0;
let angleXY = 0;
let angleZW = 0;

// Device orientation control
let deviceOrientationEnabled = false;
let deviceAlpha = 0;
let deviceBeta = 0;
let deviceGamma = 0;
let isMobile = false;

function initScene() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);
  
  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(8, 8, 8);
  camera.lookAt(0, 0, 0);
  
  // Create renderer with WebGL2
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // For future WebXR compatibility
  // renderer.xr.enabled = true;
  // document.body.appendChild(VRButton.createButton(renderer));
  
  // Add orbit controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 5;
  controls.maxDistance = 30;
  
  // Disable orbit controls on mobile when using device orientation
  isMobile = isMobileDevice();
  if (isMobile) {
    controls.enabled = false; // Will be re-enabled if user doesn't want orientation
  }
}

// ============================================================================
// Particle System
// ============================================================================

function createParticleSystem() {
  // Generate 3D lattice of 4D points
  const gridSize = 20; // 20x20x20 = 8000 particles
  const positions4D: number[] = [];
  
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      for (let z = 0; z < gridSize; z++) {
        // Map to range [-1, 1]
        const px = (x / (gridSize - 1)) * 2 - 1;
        const py = (y / (gridSize - 1)) * 2 - 1;
        const pz = (z / (gridSize - 1)) * 2 - 1;
        
        // Generate 4th dimension using a wave pattern
        const pw = Math.sin(px * Math.PI) * Math.sin(py * Math.PI) * Math.sin(pz * Math.PI);
        
        positions4D.push(px, py, pz, pw);
      }
    }
  }
  
  // Create buffer geometry
  const geometry = new THREE.BufferGeometry();
  
  // Add 4D positions as custom attribute
  const position4DArray = new Float32Array(positions4D);
  geometry.setAttribute('position4D', new THREE.BufferAttribute(position4DArray, 4));
  
  // Dummy 3D positions (will be calculated in shader)
  const dummyPositions = new Float32Array(positions4D.length / 4 * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(dummyPositions, 3));
  
  // Create shader material
  material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      time: { value: 0 },
      angleXY: { value: 0 },
      angleZW: { value: 0 },
      particleSize: { value: params.particleSize },
      spread: { value: params.spread },
      colorIntensity: { value: params.colorIntensity },
      colorAnimationSpeed: { value: params.colorAnimationSpeed },
      projectionFactor: { value: params.projectionFactor },
      sharpness: { value: params.sharpness },
      glowIntensity: { value: params.glowIntensity },
      blendFactor: { value: params.blendFactor },
      opacity: { value: params.opacity }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  
  // Create points
  points = new THREE.Points(geometry, material);
  scene.add(points);
}

// ============================================================================
// Environment
// ============================================================================

function createEnvironment() {
  // Add subtle ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);
  
  // Add grid floor for spatial reference
  const gridHelper = new THREE.GridHelper(20, 20, 0x333333, 0x1a1a1a);
  gridHelper.position.y = -6;
  scene.add(gridHelper);
  
  // Add a subtle floor plane
  const floorGeometry = new THREE.PlaneGeometry(20, 20);
  const floorMaterial = new THREE.MeshBasicMaterial({
    color: 0x0a0a0a,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -6;
  scene.add(floor);
}

// ============================================================================
// Blending Mode Helper
// ============================================================================

function getBlendingMode(mode: string): THREE.Blending {
  switch (mode) {
    case 'Normal':
      return THREE.NormalBlending;
    case 'Additive':
      return THREE.AdditiveBlending;
    case 'Subtractive':
      return THREE.SubtractiveBlending;
    case 'Multiply':
      return THREE.MultiplyBlending;
    default:
      return THREE.AdditiveBlending;
  }
}

// ============================================================================
// GUI Controls
// ============================================================================

function createGUI() {
  gui = new GUI();
  gui.title('4D Wave Controls');
  
  const rotationFolder = gui.addFolder('Rotation');
  rotationFolder.add(params, 'rotationSpeedXY', 0, 2, 0.01)
    .name('XY Speed');
  
  rotationFolder.add(params, 'rotationSpeedZW', 0, 2, 0.01)
    .name('ZW Speed');
  
  rotationFolder.open();
  
  const visualFolder = gui.addFolder('Visual');
  visualFolder.add(params, 'spread', 1, 10, 0.1)
    .name('Spread')
    .onChange((value: number) => {
      material.uniforms.spread.value = value;
    });
  
  visualFolder.add(params, 'colorIntensity', 0, 2, 0.1)
    .name('Color Intensity')
    .onChange((value: number) => {
      material.uniforms.colorIntensity.value = value;
    });
  
  visualFolder.add(params, 'colorAnimationSpeed', 0, 2, 0.01)
    .name('Color Animation')
    .onChange((value: number) => {
      material.uniforms.colorAnimationSpeed.value = value;
    });
  
  visualFolder.add(params, 'projectionFactor', 0, 2, 0.1)
    .name('Projection')
    .onChange((value: number) => {
      material.uniforms.projectionFactor.value = value;
    });
  
  visualFolder.open();
  
  const appearanceFolder = gui.addFolder('Particle Appearance');
  appearanceFolder.add(params, 'sharpness', 0, 1, 0.01)
    .name('Sharpness')
    .onChange((value: number) => {
      material.uniforms.sharpness.value = value;
    });
  
  appearanceFolder.add(params, 'glowIntensity', 0, 2, 0.1)
    .name('Glow Intensity')
    .onChange((value: number) => {
      material.uniforms.glowIntensity.value = value;
    });
  
  appearanceFolder.add(params, 'blendFactor', 0, 1, 0.01)
    .name('Blend Intensity')
    .onChange((value: number) => {
      material.uniforms.blendFactor.value = value;
    });
  
  appearanceFolder.add(params, 'opacity', 0, 1, 0.01)
    .name('Opacity')
    .onChange((value: number) => {
      material.uniforms.opacity.value = value;
    });
  
  appearanceFolder.add(params, 'blendingMode', ['Normal', 'Additive', 'Subtractive', 'Multiply'])
    .name('Blending Mode')
    .onChange((value: string) => {
      material.blending = getBlendingMode(value);
      material.needsUpdate = true;
    });
  
  appearanceFolder.add(params, 'depthWrite')
    .name('Depth Write')
    .onChange((value: boolean) => {
      material.depthWrite = value;
      material.needsUpdate = true;
    });
  
  appearanceFolder.open();
  
  gui.add(params, 'timeScale', 0, 3, 0.1).name('Time Scale');
}

// ============================================================================
// Animation Loop
// ============================================================================

function animate() {
  requestAnimationFrame(animate);
  
  // Update time for color animation
  time += 0.016 * params.timeScale; // ~60fps baseline
  material.uniforms.time.value = time;
  
  // Accumulate rotation angles smoothly based on current speeds
  const delta = 0.016 * params.timeScale;
  angleXY += delta * params.rotationSpeedXY;
  angleZW += delta * params.rotationSpeedZW;
  
  // Update shader uniforms with accumulated angles
  material.uniforms.angleXY.value = angleXY;
  material.uniforms.angleZW.value = angleZW;
  
  // Apply device orientation to camera if enabled
  if (deviceOrientationEnabled && isMobile) {
    // Convert device orientation to camera rotation
    // Beta: front-to-back tilt (pitch)
    // Gamma: left-to-right tilt (roll)
    // Alpha: compass direction (yaw)
    
    const alphaRad = THREE.MathUtils.degToRad(deviceAlpha);
    const betaRad = THREE.MathUtils.degToRad(deviceBeta);
    const gammaRad = THREE.MathUtils.degToRad(deviceGamma);
    
    // Apply rotation to camera
    camera.rotation.order = 'YXZ';
    camera.rotation.set(
      betaRad - Math.PI / 2,  // Pitch (adjust for default orientation)
      alphaRad,               // Yaw
      -gammaRad               // Roll (negative for natural feel)
    );
  } else {
    // Update orbit controls when not using device orientation
    controls.update();
  }
  
  // Render scene
  renderer.render(scene, camera);
}

// ============================================================================
// Window Resize Handler
// ============================================================================

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================================
// Device Orientation Support
// ============================================================================

function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);
}

async function requestOrientationPermission(): Promise<boolean> {
  // Check if DeviceOrientationEvent requires permission (iOS 13+)
  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    try {
      const permission = await (DeviceOrientationEvent as any).requestPermission();
      if (permission === 'granted') {
        deviceOrientationEnabled = true;
        setupDeviceOrientation();
        console.log('✅ Device orientation permission granted');
        return true;
      } else {
        console.log('❌ Device orientation permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting device orientation permission:', error);
      return false;
    }
  } else {
    // Non-iOS or older iOS - permission not required
    deviceOrientationEnabled = true;
    setupDeviceOrientation();
    return true;
  }
}

function setupDeviceOrientation() {
  window.addEventListener('deviceorientation', (event) => {
    if (deviceOrientationEnabled && event.alpha !== null && event.beta !== null && event.gamma !== null) {
      deviceAlpha = event.alpha; // 0-360 degrees (compass direction)
      deviceBeta = event.beta;   // -180 to 180 degrees (front-to-back tilt)
      deviceGamma = event.gamma; // -90 to 90 degrees (left-to-right tilt)
    }
  }, true);
  
  console.log('📱 Device orientation controls enabled');
}

// ============================================================================
// Warning Overlay
// ============================================================================

function setupWarningOverlay() {
  const overlay = document.getElementById('warning-overlay');
  const dismissButton = document.getElementById('dismiss-warning');
  
  if (dismissButton && overlay) {
    dismissButton.addEventListener('click', () => {
      overlay.classList.add('hidden');
      // Start animation after warning is dismissed
      animate();
    });
  }
}

// ============================================================================
// Initialization
// ============================================================================

function init() {
  console.log('🌌 Initializing 4D Wave Simulation...');
  
  // Setup warning overlay
  setupWarningOverlay();
  
  // Initialize Three.js components
  initScene();
  createParticleSystem();
  createEnvironment();
  createGUI();
  
  // Setup event listeners
  window.addEventListener('resize', onWindowResize);
  
  // Setup device orientation for mobile
  if (isMobile) {
    const orientationButton = document.getElementById('enable-orientation');
    if (orientationButton) {
      orientationButton.style.display = 'block';
      orientationButton.addEventListener('click', async () => {
        const granted = await requestOrientationPermission();
        if (granted) {
          controls.enabled = false; // Disable orbit controls
          orientationButton.style.display = 'none';
        }
      });
    }
  }
  
  console.log('✨ Simulation ready!');
  console.log('📊 Particle count:', points.geometry.attributes.position4D.count);
  if (isMobile) {
    console.log('📱 Mobile device detected - orientation controls available');
  }
}

// Start the application
init();

