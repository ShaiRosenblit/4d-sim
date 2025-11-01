import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';

/**
 * 4D Simulation - Wave & Indra's Net
 * 
 * This application offers two visualization modes:
 * 
 * 1. 4D Wave: Visualizes a 4D wave effect projected into 3D space.
 *    Points rotate in both XY and ZW planes simultaneously, creating a mesmerizing
 *    hyperdimensional effect when projected down to 3D.
 * 
 * 2. Indra's Net: Inspired by the Buddhist metaphor, this mode creates a network
 *    of mirror-like particles that reflect each other and colored light sources,
 *    demonstrating interconnectedness and infinite reflection.
 */

// ============================================================================
// Global State & Parameters
// ============================================================================

interface SimulationParams {
  mode: '4d-wave' | 'indras-net';
  particleCount: number;
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
  // Indra's Net specific parameters
  reflectionStrength: number;
  reflectionRange: number;
  lightIntensity: number;
  lightSpeed: number;
}

const params: SimulationParams = {
  mode: '4d-wave',
  particleCount: 8000,
  rotationSpeedXY: 0.11,
  rotationSpeedZW: 0.08,
  particleSize: 3.0,
  spread: 8.5,
  colorIntensity: 1.0,
  colorAnimationSpeed: 0.0,
  timeScale: 1.0,
  projectionFactor: 0.5,
  sharpness: 1.0,
  glowIntensity: 0.5,
  blendFactor: 1.0,
  opacity: 1.0,
  blendingMode: 'Normal',
  depthWrite: false,
  // Indra's Net specific parameters
  reflectionStrength: 1.5,
  reflectionRange: 5.0,
  lightIntensity: 2.0,
  lightSpeed: 0.3
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
// Indra's Net Shader Code
// ============================================================================

const indraVertexShader = `
  attribute vec3 position;
  attribute vec3 particlePositions; // All particle positions for reflection calculation
  
  uniform float time;
  uniform vec3 lightPosition1;
  uniform vec3 lightPosition2;
  uniform vec3 lightPosition3;
  uniform vec3 lightColor1;
  uniform vec3 lightColor2;
  uniform vec3 lightColor3;
  uniform float reflectionStrength;
  uniform float reflectionRange;
  uniform float lightIntensity;
  
  varying vec3 vColor;
  varying vec3 vPosition;
  
  void main() {
    vPosition = position;
    
    // Calculate direct lighting from light sources
    vec3 directLight = vec3(0.0);
    
    // Light 1
    vec3 toLight1 = lightPosition1 - position;
    float dist1 = length(toLight1);
    float attenuation1 = lightIntensity / (1.0 + dist1 * dist1 * 0.1);
    directLight += lightColor1 * attenuation1;
    
    // Light 2
    vec3 toLight2 = lightPosition2 - position;
    float dist2 = length(toLight2);
    float attenuation2 = lightIntensity / (1.0 + dist2 * dist2 * 0.1);
    directLight += lightColor2 * attenuation2;
    
    // Light 3
    vec3 toLight3 = lightPosition3 - position;
    float dist3 = length(toLight3);
    float attenuation3 = lightIntensity / (1.0 + dist3 * dist3 * 0.1);
    directLight += lightColor3 * attenuation3;
    
    // Start with direct light color
    vColor = directLight;
    
    // Standard transformation
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = 400.0 / -mvPosition.z;
  }
`;

const indraFragmentShader = `
  uniform float sharpness;
  uniform float opacity;
  uniform float reflectionStrength;
  
  varying vec3 vColor;
  varying vec3 vPosition;
  
  void main() {
    // Create circular points with mirror-like appearance
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    
    // Sharp, mirror-like edge
    float innerRadius = mix(0.35, 0.48, sharpness);
    float alpha = 1.0 - smoothstep(innerRadius, 0.5, dist);
    
    // Create mirror surface with radial gradient
    // Center is brightest (most reflective)
    float mirror = 1.0 - dist * 1.8;
    mirror = max(0.0, mirror);
    mirror = pow(mirror, 1.5); // Sharper falloff for mirror effect
    
    // Base reflection color from lights
    vec3 baseReflection = vColor * reflectionStrength;
    
    // Add colored fringes to simulate chromatic aberration in reflections
    // This creates a jewel-like quality
    vec2 offset = center * 2.0;
    vec3 chromaticReflection = vec3(
      baseReflection.r * (1.0 + offset.x * 0.2),
      baseReflection.g * (1.0 + offset.y * 0.2),
      baseReflection.b * (1.0 - length(offset) * 0.1)
    );
    
    // Apply mirror enhancement
    vec3 finalColor = chromaticReflection * (0.3 + mirror * 2.0);
    
    // Add strong specular highlight to simulate perfect reflection
    float specular = pow(1.0 - dist * 2.0, 12.0);
    finalColor += vec3(1.0) * specular * 1.5;
    
    // Add secondary softer glow for ambient reflection
    float ambientGlow = pow(1.0 - dist * 1.5, 3.0);
    finalColor += vColor * ambientGlow * 0.3;
    
    // Subtle rim lighting to enhance 3D appearance
    float rim = smoothstep(0.3, 0.5, dist);
    finalColor += vColor * rim * 0.2;
    
    gl_FragColor = vec4(finalColor, alpha * opacity);
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

// Light sources for Indra's Net mode
let lightPositions = {
  light1: new THREE.Vector3(),
  light2: new THREE.Vector3(),
  light3: new THREE.Vector3()
};

// Light visualizer meshes
let lightMeshes: THREE.Mesh[] = [];

// Device orientation control
let deviceOrientationEnabled = false;
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
  
  // Check if mobile device
  isMobile = isMobileDevice();
}

// ============================================================================
// Particle System
// ============================================================================

function createParticleSystem() {
  if (params.mode === '4d-wave') {
    create4DWaveParticles();
  } else {
    createIndrasNetParticles();
  }
}

function create4DWaveParticles() {
  // Calculate grid size from particle count
  const gridSize = Math.ceil(Math.pow(params.particleCount, 1/3));
  const positions4D: number[] = [];
  
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      for (let z = 0; z < gridSize; z++) {
        if (positions4D.length / 4 >= params.particleCount) break;
        
        // Map to range [-1, 1]
        const px = (x / (gridSize - 1)) * 2 - 1;
        const py = (y / (gridSize - 1)) * 2 - 1;
        const pz = (z / (gridSize - 1)) * 2 - 1;
        
        // Generate 4th dimension using a wave pattern
        const pw = Math.sin(px * Math.PI) * Math.sin(py * Math.PI) * Math.sin(pz * Math.PI);
        
        positions4D.push(px, py, pz, pw);
      }
      if (positions4D.length / 4 >= params.particleCount) break;
    }
    if (positions4D.length / 4 >= params.particleCount) break;
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
    depthWrite: params.depthWrite,
    blending: getBlendingMode(params.blendingMode)
  });
  
  // Create points
  points = new THREE.Points(geometry, material);
  scene.add(points);
}

function createIndrasNetParticles() {
  // Create particle positions in a 3D grid
  const gridSize = Math.ceil(Math.pow(params.particleCount, 1/3));
  const positions: number[] = [];
  const spacing = 2.0;
  
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      for (let z = 0; z < gridSize; z++) {
        if (positions.length / 3 >= params.particleCount) break;
        
        // Map to range centered at origin
        const px = (x / (gridSize - 1) - 0.5) * gridSize * spacing;
        const py = (y / (gridSize - 1) - 0.5) * gridSize * spacing;
        const pz = (z / (gridSize - 1) - 0.5) * gridSize * spacing;
        
        positions.push(px, py, pz);
      }
      if (positions.length / 3 >= params.particleCount) break;
    }
    if (positions.length / 3 >= params.particleCount) break;
  }
  
  // Create buffer geometry
  const geometry = new THREE.BufferGeometry();
  const positionArray = new Float32Array(positions);
  geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
  
  // Create shader material for Indra's Net
  material = new THREE.ShaderMaterial({
    vertexShader: indraVertexShader,
    fragmentShader: indraFragmentShader,
    uniforms: {
      time: { value: 0 },
      lightPosition1: { value: lightPositions.light1 },
      lightPosition2: { value: lightPositions.light2 },
      lightPosition3: { value: lightPositions.light3 },
      lightColor1: { value: new THREE.Color(1.0, 0.3, 0.3) },
      lightColor2: { value: new THREE.Color(0.3, 1.0, 0.3) },
      lightColor3: { value: new THREE.Color(0.3, 0.3, 1.0) },
      reflectionStrength: { value: params.reflectionStrength },
      reflectionRange: { value: params.reflectionRange },
      lightIntensity: { value: params.lightIntensity },
      sharpness: { value: params.sharpness },
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

function createLightVisualizers() {
  // Remove old light meshes if they exist
  removeLightVisualizers();
  
  const lightColors = [
    new THREE.Color(1.0, 0.3, 0.3),
    new THREE.Color(0.3, 1.0, 0.3),
    new THREE.Color(0.3, 0.3, 1.0)
  ];
  
  for (let i = 0; i < 3; i++) {
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: lightColors[i],
      transparent: true,
      opacity: 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    lightMeshes.push(mesh);
    scene.add(mesh);
  }
}

function removeLightVisualizers() {
  lightMeshes.forEach(mesh => {
    scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
  lightMeshes = [];
}

function recreateParticleSystem() {
  // Remove old particle system
  if (points) {
    scene.remove(points);
    points.geometry.dispose();
    material.dispose();
  }
  
  // Create new particle system
  createParticleSystem();
  
  // Handle light visualizers for Indra's Net mode
  if (params.mode === 'indras-net') {
    createLightVisualizers();
  } else {
    removeLightVisualizers();
  }
  
  // Update GUI visibility based on mode
  updateGUIForMode();
  
  console.log('✨ Switched to', params.mode, 'mode with', points.geometry.attributes.position.count, 'particles');
}

function updateGUIForMode() {
  // This will be called to show/hide mode-specific controls
  // Implementation will be added with GUI creation
}

function createGUI() {
  gui = new GUI();
  gui.title('Simulation Controls');
  
  // Hide GUI on mobile by default
  if (isMobile) {
    gui.domElement.classList.add('hidden-mobile');
  }
  
  // Mode selector at the top
  gui.add(params, 'mode', ['4d-wave', 'indras-net'])
    .name('Mode')
    .onChange(() => {
      recreateParticleSystem();
    });
  
  // Particle count control (applies to both modes)
  gui.add(params, 'particleCount', 50, 8000, 50)
    .name('Particle Count')
    .onChange(() => {
      recreateParticleSystem();
    });
  
  const rotationFolder = gui.addFolder('Rotation (4D Mode)');
  rotationFolder.add(params, 'rotationSpeedXY', 0, 2, 0.01)
    .name('XY Speed');
  
  rotationFolder.add(params, 'rotationSpeedZW', 0, 2, 0.01)
    .name('ZW Speed');
  
  rotationFolder.close();
  
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
  
  // Indra's Net specific controls
  const indraFolder = gui.addFolder("Indra's Net");
  indraFolder.add(params, 'reflectionStrength', 0, 2, 0.1)
    .name('Reflection Strength')
    .onChange((value: number) => {
      if (material.uniforms.reflectionStrength) {
        material.uniforms.reflectionStrength.value = value;
      }
    });
  
  indraFolder.add(params, 'reflectionRange', 1, 10, 0.5)
    .name('Reflection Range')
    .onChange((value: number) => {
      if (material.uniforms.reflectionRange) {
        material.uniforms.reflectionRange.value = value;
      }
    });
  
  indraFolder.add(params, 'lightIntensity', 0, 3, 0.1)
    .name('Light Intensity')
    .onChange((value: number) => {
      if (material.uniforms.lightIntensity) {
        material.uniforms.lightIntensity.value = value;
      }
    });
  
  indraFolder.add(params, 'lightSpeed', 0, 2, 0.1)
    .name('Light Speed');
  
  indraFolder.close();
}

// ============================================================================
// Animation Loop
// ============================================================================

function animate() {
  requestAnimationFrame(animate);
  
  // Update time for color animation
  time += 0.016 * params.timeScale; // ~60fps baseline
  material.uniforms.time.value = time;
  
  if (params.mode === '4d-wave') {
    // Accumulate rotation angles smoothly based on current speeds
    const delta = 0.016 * params.timeScale;
    angleXY += delta * params.rotationSpeedXY;
    angleZW += delta * params.rotationSpeedZW;
    
    // Update shader uniforms with accumulated angles
    if (material.uniforms.angleXY) {
      material.uniforms.angleXY.value = angleXY;
    }
    if (material.uniforms.angleZW) {
      material.uniforms.angleZW.value = angleZW;
    }
  } else if (params.mode === 'indras-net') {
    // Animate light positions in orbit patterns
    const radius = 15;
    const speed = params.lightSpeed;
    
    lightPositions.light1.set(
      Math.cos(time * speed) * radius,
      Math.sin(time * speed * 0.7) * radius * 0.5,
      Math.sin(time * speed) * radius
    );
    
    lightPositions.light2.set(
      Math.sin(time * speed * 0.8) * radius,
      Math.cos(time * speed * 0.6) * radius,
      Math.cos(time * speed * 0.8) * radius * 0.7
    );
    
    lightPositions.light3.set(
      Math.sin(time * speed * 1.2) * radius * 0.8,
      Math.sin(time * speed) * radius * 0.6,
      Math.cos(time * speed * 1.2) * radius
    );
    
    // Update uniforms
    if (material.uniforms.lightPosition1) {
      material.uniforms.lightPosition1.value = lightPositions.light1;
      material.uniforms.lightPosition2.value = lightPositions.light2;
      material.uniforms.lightPosition3.value = lightPositions.light3;
    }
    
    // Update light visualizer positions
    if (lightMeshes.length === 3) {
      lightMeshes[0].position.copy(lightPositions.light1);
      lightMeshes[1].position.copy(lightPositions.light2);
      lightMeshes[2].position.copy(lightPositions.light3);
    }
  }
  
  // Apply device orientation to camera if enabled
  if (deviceOrientationEnabled && isMobile) {
    // Convert device orientation to orbit angles
    // Beta controls vertical rotation (pitch): -180 to 180
    // Gamma controls horizontal rotation (yaw): -90 to 90
    
    // Map beta (tilt forward/back) to polar angle
    // When device is held upright (beta = 0), look at scene
    // When tilted forward (beta = 90), look down
    // When tilted back (beta = -90), look up
    const targetPolarAngle = THREE.MathUtils.degToRad(90 - deviceBeta);
    
    // Map gamma (tilt left/right) to azimuthal angle
    // When device is level (gamma = 0), face forward
    // When tilted left (gamma < 0), rotate camera left
    // When tilted right (gamma > 0), rotate camera right
    const targetAzimuthalAngle = THREE.MathUtils.degToRad(deviceGamma);
    
    // Smoothly interpolate to target angles
    const smoothing = 0.1;
    const currentPolar = controls.getPolarAngle();
    const currentAzimuthal = controls.getAzimuthalAngle();
    
    const newPolar = currentPolar + (targetPolarAngle - currentPolar) * smoothing;
    const newAzimuthal = currentAzimuthal + (targetAzimuthalAngle - currentAzimuthal) * smoothing;
    
    // Calculate new camera position based on spherical coordinates
    const radius = camera.position.distanceTo(controls.target);
    const x = radius * Math.sin(newPolar) * Math.sin(newAzimuthal);
    const y = radius * Math.cos(newPolar);
    const z = radius * Math.sin(newPolar) * Math.cos(newAzimuthal);
    
    camera.position.set(x, y, z);
    camera.lookAt(controls.target);
    
    controls.update();
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
    if (deviceOrientationEnabled && event.beta !== null && event.gamma !== null) {
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
  console.log('🌌 Initializing Simulation...');
  
  // Setup warning overlay
  setupWarningOverlay();
  
  // Initialize Three.js components
  initScene();
  createParticleSystem();
  createEnvironment();
  createGUI();
  
  // Setup event listeners
  window.addEventListener('resize', onWindowResize);
  
  // Setup mobile-specific controls
  if (isMobile) {
    // Setup toggle controls button
    const toggleButton = document.getElementById('toggle-controls');
    if (toggleButton) {
      toggleButton.style.display = 'flex';
      let guiVisible = false;
      
      toggleButton.addEventListener('click', () => {
        guiVisible = !guiVisible;
        if (guiVisible) {
          gui.domElement.classList.remove('hidden-mobile');
          toggleButton.textContent = '✕';
        } else {
          gui.domElement.classList.add('hidden-mobile');
          toggleButton.textContent = '⚙️';
        }
      });
    }
    
    // Setup device orientation button
    const orientationButton = document.getElementById('enable-orientation');
    if (orientationButton) {
      orientationButton.style.display = 'block';
      orientationButton.addEventListener('click', async () => {
        const granted = await requestOrientationPermission();
        if (granted) {
          // Keep orbit controls enabled for smooth updates
          orientationButton.style.display = 'none';
        }
      });
    }
  }
  
  console.log('✨ Simulation ready!');
  const particleCount = params.mode === '4d-wave' 
    ? points.geometry.attributes.position4D?.count 
    : points.geometry.attributes.position?.count;
  console.log('📊 Particle count:', particleCount);
  console.log('🎨 Mode:', params.mode);
  if (isMobile) {
    console.log('📱 Mobile device detected - orientation controls available');
  }
}

// Start the application
init();

