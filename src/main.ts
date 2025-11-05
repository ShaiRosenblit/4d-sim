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
  gridSize: number; // Number of points along each dimension of the 4D hypercube
  rotationSpeedXY: number;
  rotationSpeedZW: number;
  rotationActiveXY: boolean;
  rotationActiveZW: boolean;
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
  // Matrix transformation parameters
  matrix1: number[];
  matrix2: number[];
  interpolation: number;
  // Indra's Net specific parameters
  reflectionStrength: number;
  reflectionRange: number;
  lightIntensity: number;
  lightSpeed: number;
}

// Helper function to create identity matrix
function createIdentityMatrix(): number[] {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

const params: SimulationParams = {
  mode: '4d-wave',
  gridSize: 10, // 10 points along each dimension = 10^4 = 10,000 particles
  rotationSpeedXY: 0.5,
  rotationSpeedZW: 0.5,
  rotationActiveXY: true, // Rotate by default
  rotationActiveZW: true, // Rotate by default
  particleSize: 0.5, // Small dots by default
  spread: 3.0,
  colorIntensity: 1.0,
  colorAnimationSpeed: 0.0,
  timeScale: 1.0,
  projectionFactor: 0.15,
  sharpness: 1.0,
  glowIntensity: 0.5,
  blendFactor: 1.0,
  opacity: 1.0,
  blendingMode: 'Normal',
  depthWrite: false,
  // Matrix transformation parameters
  matrix1: createIdentityMatrix(),
  matrix2: createIdentityMatrix(),
  interpolation: 0.5,
  // Indra's Net specific parameters
  reflectionStrength: 2.5,
  reflectionRange: 5.0,
  lightIntensity: 3.0,
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
  uniform float particleSize;
  
  // Matrix transformation uniforms
  uniform mat4 matrix1;
  uniform mat4 matrix2;
  uniform float interpolation;
  
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
  
  // Interpolate between two matrices
  mat4 mixMatrix(mat4 m1, mat4 m2, float t) {
    return mat4(
      mix(m1[0], m2[0], t),
      mix(m1[1], m2[1], t),
      mix(m1[2], m2[2], t),
      mix(m1[3], m2[3], t)
    );
  }
  
  void main() {
    // Start with normalized 4D position [-1, 1]
    vec4 pos4D = position4D;
    
    // Apply interpolated matrix transformation
    mat4 currentMatrix = mixMatrix(matrix1, matrix2, interpolation);
    pos4D = currentMatrix * pos4D;
    
    // Apply 4D rotations using accumulated angles
    pos4D = rotateXY(pos4D, angleXY);
    pos4D = rotateZW(pos4D, angleZW);
    
    // Project from 4D to 3D using perspective projection
    // The further away in the 4th dimension, the smaller it appears
    float wFactor = 1.0 + pos4D.w * projectionFactor;
    vec3 pos3D = pos4D.xyz / wFactor;
    
    // Apply spread scaling to final 3D positions
    pos3D *= spread;
    
    // Calculate color based on 4D position with independent animation speed
    // Map 4D coordinates to RGB - using W coordinate heavily for color variation
    float colorTime = time * colorAnimationSpeed;
    vColor = vec3(
      0.5 + 0.5 * sin(pos4D.w * 2.0 + colorTime),
      0.5 + 0.5 * sin(pos4D.w * 2.0 + 2.094),  // 2.094 radians ≈ 120 degrees for RGB separation
      0.5 + 0.5 * sin(pos4D.w * 2.0 + 4.189)   // 4.189 radians ≈ 240 degrees
    );
    
    // Calculate intensity based on distance from origin in 4D
    float dist4D = length(pos4D);
    vIntensity = 0.5 + 0.5 * sin(dist4D * 0.3 - colorTime);
    
    // Standard Three.js transformation
    vec4 mvPosition = modelViewMatrix * vec4(pos3D, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Point size based on distance (closer = bigger) and particleSize uniform
    gl_PointSize = (300.0 * particleSize) / -mvPosition.z;
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
  uniform mat4 viewMatrix;
  
  varying vec3 vColor;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vLightPos1;
  varying vec3 vLightPos2;
  varying vec3 vLightPos3;
  varying vec3 vLightColor1;
  varying vec3 vLightColor2;
  varying vec3 vLightColor3;
  
  void main() {
    vPosition = position;
    
    // Pass light data to fragment shader for proper reflection calculation
    vLightPos1 = lightPosition1;
    vLightPos2 = lightPosition2;
    vLightPos3 = lightPosition3;
    vLightColor1 = lightColor1;
    vLightColor2 = lightColor2;
    vLightColor3 = lightColor3;
    
    // Standard transformation
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = 100.0 / -mvPosition.z;
  }
`;

const indraFragmentShader = `
  uniform float sharpness;
  uniform float opacity;
  uniform float reflectionStrength;
  uniform float lightIntensity;
  
  varying vec3 vColor;
  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec3 vLightPos1;
  varying vec3 vLightPos2;
  varying vec3 vLightPos3;
  varying vec3 vLightColor1;
  varying vec3 vLightColor2;
  varying vec3 vLightColor3;
  
  void main() {
    // Create circular points with mirror-like appearance
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    
    // Sharp, mirror-like edge
    float innerRadius = mix(0.35, 0.48, sharpness);
    float alpha = 1.0 - smoothstep(innerRadius, 0.5, dist);
    
    // Calculate surface normal for the spherical point
    // This makes each point act like a tiny sphere mirror
    vec3 normal;
    normal.xy = (gl_PointCoord - 0.5) * 2.0;
    float r2 = dot(normal.xy, normal.xy);
    if (r2 > 1.0) discard;
    normal.z = sqrt(1.0 - r2);
    
    // View direction (toward camera)
    vec3 viewDir = normalize(vViewPosition);
    
    // Mirror base color (neutral silver/white)
    vec3 mirrorBase = vec3(0.9, 0.9, 0.95);
    
    // Calculate reflections from each light source
    vec3 reflectedColor = vec3(0.0);
    
    // Light 1 reflection
    vec3 lightDir1 = normalize(vLightPos1 - vPosition);
    vec3 reflectDir1 = reflect(-lightDir1, normal);
    float spec1 = pow(max(dot(reflectDir1, viewDir), 0.0), 32.0);
    float dist1 = length(vLightPos1 - vPosition);
    float attenuation1 = lightIntensity / (1.0 + dist1 * dist1 * 0.05);
    reflectedColor += vLightColor1 * spec1 * attenuation1;
    
    // Light 2 reflection
    vec3 lightDir2 = normalize(vLightPos2 - vPosition);
    vec3 reflectDir2 = reflect(-lightDir2, normal);
    float spec2 = pow(max(dot(reflectDir2, viewDir), 0.0), 32.0);
    float dist2 = length(vLightPos2 - vPosition);
    float attenuation2 = lightIntensity / (1.0 + dist2 * dist2 * 0.05);
    reflectedColor += vLightColor2 * spec2 * attenuation2;
    
    // Light 3 reflection
    vec3 lightDir3 = normalize(vLightPos3 - vPosition);
    vec3 reflectDir3 = reflect(-lightDir3, normal);
    float spec3 = pow(max(dot(reflectDir3, viewDir), 0.0), 32.0);
    float dist3 = length(vLightPos3 - vPosition);
    float attenuation3 = lightIntensity / (1.0 + dist3 * dist3 * 0.05);
    reflectedColor += vLightColor3 * spec3 * attenuation3;
    
    // Combine mirror base with reflections
    vec3 finalColor = mirrorBase * (0.15 + reflectedColor * reflectionStrength);
    
    // Add bright specular highlights for perfect mirror effect
    float centerGlow = pow(1.0 - dist * 2.0, 16.0);
    finalColor += mirrorBase * centerGlow * 0.8;
    
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
  // Use grid size directly (creates gridSize^4 particles)
  const gridSize = params.gridSize;
  const positions4D: number[] = [];
  
  // Create a true 4D hypercube lattice
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      for (let z = 0; z < gridSize; z++) {
        for (let w = 0; w < gridSize; w++) {
          // Map all dimensions uniformly to range [-1, 1]
          const px = (x / (gridSize - 1)) * 2 - 1;
          const py = (y / (gridSize - 1)) * 2 - 1;
          const pz = (z / (gridSize - 1)) * 2 - 1;
          const pw = (w / (gridSize - 1)) * 2 - 1;
          
          positions4D.push(px, py, pz, pw);
        }
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
      opacity: { value: params.opacity },
      // Matrix transformation uniforms
      matrix1: { value: new THREE.Matrix4().fromArray(params.matrix1) },
      matrix2: { value: new THREE.Matrix4().fromArray(params.matrix2) },
      interpolation: { value: params.interpolation }
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
  // Create particle positions in a 3D grid (using gridSize directly)
  const gridSize = params.gridSize;
  const positions: number[] = [];
  const spacing = 0.5; // Much smaller spacing for better visualization
  
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      for (let z = 0; z < gridSize; z++) {
        // Map to range centered at origin with tighter spacing
        const px = (x / (gridSize - 1) - 0.5) * gridSize * spacing;
        const py = (y / (gridSize - 1) - 0.5) * gridSize * spacing;
        const pz = (z / (gridSize - 1) - 0.5) * gridSize * spacing;
        
        positions.push(px, py, pz);
      }
    }
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
      lightColor1: { value: new THREE.Color(1.0, 0.2, 0.2) },
      lightColor2: { value: new THREE.Color(0.2, 1.0, 0.2) },
      lightColor3: { value: new THREE.Color(0.2, 0.2, 1.0) },
      reflectionStrength: { value: params.reflectionStrength },
      reflectionRange: { value: params.reflectionRange },
      lightIntensity: { value: params.lightIntensity },
      sharpness: { value: params.sharpness },
      opacity: { value: params.opacity }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending
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
// Export/Import and Reset Functions
// ============================================================================

function exportParameters(): void {
  const data = {
    mode: params.mode,
    gridSize: params.gridSize,
    rotationSpeedXY: params.rotationSpeedXY,
    rotationSpeedZW: params.rotationSpeedZW,
    rotationActiveXY: params.rotationActiveXY,
    rotationActiveZW: params.rotationActiveZW,
    particleSize: params.particleSize,
    spread: params.spread,
    colorIntensity: params.colorIntensity,
    colorAnimationSpeed: params.colorAnimationSpeed,
    timeScale: params.timeScale,
    projectionFactor: params.projectionFactor,
    sharpness: params.sharpness,
    glowIntensity: params.glowIntensity,
    blendFactor: params.blendFactor,
    opacity: params.opacity,
    blendingMode: params.blendingMode,
    depthWrite: params.depthWrite,
    matrix1: params.matrix1,
    matrix2: params.matrix2,
    interpolation: params.interpolation,
    reflectionStrength: params.reflectionStrength,
    reflectionRange: params.reflectionRange,
    lightIntensity: params.lightIntensity,
    lightSpeed: params.lightSpeed
  };
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '4d-wave-parameters.json';
  link.click();
  URL.revokeObjectURL(url);
  console.log('✅ Parameters exported');
}

function importParameters(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        // Update params object
        Object.assign(params, data);
        
        // Update shader uniforms
        if (material.uniforms.matrix1) {
          material.uniforms.matrix1.value.fromArray(params.matrix1);
        }
        if (material.uniforms.matrix2) {
          material.uniforms.matrix2.value.fromArray(params.matrix2);
        }
        if (material.uniforms.interpolation) {
          material.uniforms.interpolation.value = params.interpolation;
        }
        
        // Recreate particle system if particle count changed
        recreateParticleSystem();
        
        // Update GUI
        gui.destroy();
        createGUI();
        
        console.log('✅ Parameters imported');
      } catch (error) {
        console.error('❌ Error importing parameters:', error);
        alert('Error importing parameters. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function resetRotation(): void {
  // Reset all transformations that affect particle positions in all 4 axes
  // 1. Reset rotation angles
  angleXY = 0;
  angleZW = 0;
  
  // 2. Reset matrix transformations to identity
  params.matrix1 = createIdentityMatrix();
  params.matrix2 = createIdentityMatrix();
  params.interpolation = 0.5;
  
  // 3. Update shader uniforms
  if (material.uniforms.matrix1) {
    material.uniforms.matrix1.value.fromArray(params.matrix1);
  }
  if (material.uniforms.matrix2) {
    material.uniforms.matrix2.value.fromArray(params.matrix2);
  }
  if (material.uniforms.interpolation) {
    material.uniforms.interpolation.value = params.interpolation;
  }
  
  console.log('🔄 All particle positions reset to initial state (all 4 axes)');
}

function resetToDefault(): void {
  // Reset to default values
  params.gridSize = 10;
  params.matrix1 = createIdentityMatrix();
  params.matrix2 = createIdentityMatrix();
  params.interpolation = 0.5;
  params.rotationSpeedXY = 0.5;
  params.rotationSpeedZW = 0.5;
  params.rotationActiveXY = true; // Rotate by default
  params.rotationActiveZW = true; // Rotate by default
  params.particleSize = 0.5;
  params.spread = 3.0;
  params.colorIntensity = 1.0;
  params.colorAnimationSpeed = 0.0;
  params.projectionFactor = 0.15;
  params.sharpness = 1.0;
  params.glowIntensity = 0.5;
  params.blendFactor = 1.0;
  params.opacity = 1.0;
  params.blendingMode = 'Normal';
  params.depthWrite = false;
  
  // Update shader uniforms
  if (material.uniforms.matrix1) {
    material.uniforms.matrix1.value.fromArray(params.matrix1);
  }
  if (material.uniforms.matrix2) {
    material.uniforms.matrix2.value.fromArray(params.matrix2);
  }
  if (material.uniforms.interpolation) {
    material.uniforms.interpolation.value = params.interpolation;
  }
  if (material.uniforms.particleSize) {
    material.uniforms.particleSize.value = params.particleSize;
  }
  if (material.uniforms.spread) {
    material.uniforms.spread.value = params.spread;
  }
  if (material.uniforms.colorIntensity) {
    material.uniforms.colorIntensity.value = params.colorIntensity;
  }
  if (material.uniforms.projectionFactor) {
    material.uniforms.projectionFactor.value = params.projectionFactor;
  }
  
  // Reset rotation angles
  angleXY = 0;
  angleZW = 0;
  
  // Recreate particle system with new grid size
  recreateParticleSystem();
  
  console.log('✅ Reset to default parameters');
}

function randomizeParameters(): void {
  // Randomize matrix transformations
  for (let i = 0; i < 16; i++) {
    params.matrix1[i] = (Math.random() - 0.5) * 4; // -2 to 2
    params.matrix2[i] = (Math.random() - 0.5) * 4; // -2 to 2
  }
  params.interpolation = Math.random();
  
  // Randomize rotation speeds
  params.rotationSpeedXY = Math.random() * 2; // 0 to 2
  params.rotationSpeedZW = Math.random() * 2; // 0 to 2
  params.rotationActiveXY = Math.random() > 0.3; // 70% chance to be active
  params.rotationActiveZW = Math.random() > 0.3; // 70% chance to be active
  
  // Randomize visual parameters
  params.particleSize = Math.random() * 3 + 0.2; // 0.2 to 3.2
  params.spread = Math.random() * 7 + 2; // 2 to 9
  params.colorIntensity = Math.random() * 1.5 + 0.3; // 0.3 to 1.8
  params.colorAnimationSpeed = Math.random() * 1.5; // 0 to 1.5
  params.projectionFactor = Math.random() * 1.5; // 0 to 1.5
  params.sharpness = Math.random(); // 0 to 1
  params.glowIntensity = Math.random() * 1.5; // 0 to 1.5
  params.blendFactor = Math.random() * 0.7 + 0.3; // 0.3 to 1
  params.opacity = Math.random() * 0.5 + 0.5; // 0.5 to 1
  
  // Randomize blending mode
  const blendingModes = ['Normal', 'Additive', 'Subtractive', 'Multiply'];
  params.blendingMode = blendingModes[Math.floor(Math.random() * blendingModes.length)];
  params.depthWrite = Math.random() > 0.7; // 30% chance to be true
  
  // Randomize Indra's Net parameters
  params.reflectionStrength = Math.random() * 5; // 0 to 5
  params.reflectionRange = Math.random() * 8 + 2; // 2 to 10
  params.lightIntensity = Math.random() * 4 + 0.5; // 0.5 to 4.5
  params.lightSpeed = Math.random() * 1.5 + 0.2; // 0.2 to 1.7
  
  // Update all shader uniforms
  if (material.uniforms.matrix1) {
    material.uniforms.matrix1.value.fromArray(params.matrix1);
  }
  if (material.uniforms.matrix2) {
    material.uniforms.matrix2.value.fromArray(params.matrix2);
  }
  if (material.uniforms.interpolation) {
    material.uniforms.interpolation.value = params.interpolation;
  }
  if (material.uniforms.particleSize) {
    material.uniforms.particleSize.value = params.particleSize;
  }
  if (material.uniforms.spread) {
    material.uniforms.spread.value = params.spread;
  }
  if (material.uniforms.colorIntensity) {
    material.uniforms.colorIntensity.value = params.colorIntensity;
  }
  if (material.uniforms.colorAnimationSpeed) {
    material.uniforms.colorAnimationSpeed.value = params.colorAnimationSpeed;
  }
  if (material.uniforms.projectionFactor) {
    material.uniforms.projectionFactor.value = params.projectionFactor;
  }
  if (material.uniforms.sharpness) {
    material.uniforms.sharpness.value = params.sharpness;
  }
  if (material.uniforms.glowIntensity) {
    material.uniforms.glowIntensity.value = params.glowIntensity;
  }
  if (material.uniforms.blendFactor) {
    material.uniforms.blendFactor.value = params.blendFactor;
  }
  if (material.uniforms.opacity) {
    material.uniforms.opacity.value = params.opacity;
  }
  if (material.uniforms.reflectionStrength) {
    material.uniforms.reflectionStrength.value = params.reflectionStrength;
  }
  if (material.uniforms.reflectionRange) {
    material.uniforms.reflectionRange.value = params.reflectionRange;
  }
  if (material.uniforms.lightIntensity) {
    material.uniforms.lightIntensity.value = params.lightIntensity;
  }
  
  // Update material properties
  material.blending = getBlendingMode(params.blendingMode);
  material.depthWrite = params.depthWrite;
  material.needsUpdate = true;
  
  // Recreate GUI to reflect new values
  gui.destroy();
  createGUI();
  
  console.log('🎲 Parameters randomized!');
}

// ============================================================================
// GUI Controls
// ============================================================================

function createLightVisualizers() {
  // Remove old light meshes if they exist
  removeLightVisualizers();
  
  const lightColors = [
    new THREE.Color(1.0, 0.2, 0.2),
    new THREE.Color(0.2, 1.0, 0.2),
    new THREE.Color(0.2, 0.2, 1.0)
  ];
  
  for (let i = 0; i < 3; i++) {
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: lightColors[i],
      transparent: true,
      opacity: 0.9
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
    // Adjust camera for better view of Indra's net
    camera.position.set(12, 12, 12);
    camera.lookAt(0, 0, 0);
    controls.update();
  } else {
    removeLightVisualizers();
    // Reset camera for 4D wave mode
    camera.position.set(8, 8, 8);
    camera.lookAt(0, 0, 0);
    controls.update();
  }
  
  // Update GUI visibility based on mode
  updateGUIForMode();
  
  const particleCount = params.mode === '4d-wave' 
    ? Math.pow(params.gridSize, 4)
    : Math.pow(params.gridSize, 3);
  console.log('✨ Switched to', params.mode, 'mode with grid size', params.gridSize, '(', particleCount, 'particles)');
}

function updateGUIForMode() {
  // This will be called to show/hide mode-specific controls
  // Implementation will be added with GUI creation
}

function createGUI() {
  gui = new GUI();
  gui.title('4D Wave Control');
  
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
  
  // Grid size control (number of points along each dimension)
  gui.add(params, 'gridSize', 2, 20, 1)
    .name('Grid Size')
    .onChange(() => {
      recreateParticleSystem();
    });
  
  // Matrix 1 controls
  const matrix1Folder = gui.addFolder('Matrix 1');
  const matrix1Proxies: { [key: string]: number } = {};
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const index = i * 4 + j;
      const key = `m1_${i}_${j}`;
      matrix1Proxies[key] = params.matrix1[index];
      
      matrix1Folder.add(matrix1Proxies, key, -2, 2, 0.01)
        .name(`[${i}][${j}]`)
        .onChange((value: number) => {
          params.matrix1[index] = value;
          if (material.uniforms.matrix1) {
            material.uniforms.matrix1.value.fromArray(params.matrix1);
          }
        });
    }
  }
  matrix1Folder.close();
  
  // Matrix 2 controls
  const matrix2Folder = gui.addFolder('Matrix 2');
  const matrix2Proxies: { [key: string]: number } = {};
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const index = i * 4 + j;
      const key = `m2_${i}_${j}`;
      matrix2Proxies[key] = params.matrix2[index];
      
      matrix2Folder.add(matrix2Proxies, key, -2, 2, 0.01)
        .name(`[${i}][${j}]`)
        .onChange((value: number) => {
          params.matrix2[index] = value;
          if (material.uniforms.matrix2) {
            material.uniforms.matrix2.value.fromArray(params.matrix2);
          }
        });
    }
  }
  matrix2Folder.close();
  
  // Interpolation control
  gui.add(params, 'interpolation', 0, 1, 0.01)
    .name('Interpolation')
    .onChange((value: number) => {
      if (material.uniforms.interpolation) {
        material.uniforms.interpolation.value = value;
      }
    });
  
  // 4D Rotations folder
  const rotationFolder = gui.addFolder('4D Rotations');
  
  // XY Rotation toggle
  rotationFolder.add(params, 'rotationActiveXY').name('XY Rotation');
  rotationFolder.add(params, 'rotationSpeedXY', 0, 5, 0.01).name('XY Speed');
  
  // ZW Rotation toggle
  rotationFolder.add(params, 'rotationActiveZW').name('ZW Rotation');
  rotationFolder.add(params, 'rotationSpeedZW', 0, 5, 0.01).name('ZW Speed');
  
  // Reset rotation position button
  const rotationResetControls = {
    resetPosition: resetRotation
  };
  rotationFolder.add(rotationResetControls, 'resetPosition').name('Reset Position');
  
  rotationFolder.open();
  
  // Export/Import/Reset controls
  const fileControls = {
    export: exportParameters,
    import: importParameters,
    randomize: randomizeParameters,
    reset: resetToDefault
  };
  gui.add(fileControls, 'export').name('Export Parameters');
  gui.add(fileControls, 'import').name('Import Parameters');
  gui.add(fileControls, 'randomize').name('🎲 Randomize All');
  gui.add(fileControls, 'reset').name('🏠 Reset to Default');
  
  // Device Orientation (Mobile only)
  if (isMobile) {
    const mobileControls = {
      enableOrientation: async () => {
        const granted = await requestOrientationPermission();
        if (granted) {
          console.log('✅ Device orientation enabled');
        }
      }
    };
    gui.add(mobileControls, 'enableOrientation').name('📱 Enable Device Tilt');
  }
  
  // Visual settings folder
  const visualFolder = gui.addFolder('Visual Settings');
  
  visualFolder.add(params, 'particleSize', 0.1, 5, 0.1)
    .name('Particle Size')
    .onChange((value: number) => {
      material.uniforms.particleSize.value = value;
    });
  
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
  
  visualFolder.add(params, 'projectionFactor', 0, 2, 0.01)
    .name('Projection')
    .onChange((value: number) => {
      material.uniforms.projectionFactor.value = value;
    });
  
  visualFolder.close();
  
  // Particle Appearance folder
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
  
  appearanceFolder.close();
  
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
    // Accumulate rotation angles smoothly based on current speeds (only if active)
    const delta = 0.016 * params.timeScale;
    if (params.rotationActiveXY) {
      angleXY += delta * params.rotationSpeedXY;
    }
    if (params.rotationActiveZW) {
      angleZW += delta * params.rotationSpeedZW;
    }
    
    // Update shader uniforms with accumulated angles
    if (material.uniforms.angleXY) {
      material.uniforms.angleXY.value = angleXY;
    }
    if (material.uniforms.angleZW) {
      material.uniforms.angleZW.value = angleZW;
    }
    
    // Update matrix interpolation uniform
    if (material.uniforms.interpolation) {
      material.uniforms.interpolation.value = params.interpolation;
    }
  } else if (params.mode === 'indras-net') {
    // Animate light positions in orbit patterns
    const radius = 8; // Adjusted for smaller particle grid
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
    const dragHandle = document.getElementById('gui-drag-handle');
    
    if (toggleButton) {
      toggleButton.style.display = 'flex';
      let guiVisible = false;
      
      toggleButton.addEventListener('click', () => {
        guiVisible = !guiVisible;
        if (guiVisible) {
          gui.domElement.classList.remove('hidden-mobile');
          if (dragHandle) dragHandle.classList.remove('hidden-mobile');
          toggleButton.textContent = '✕';
        } else {
          gui.domElement.classList.add('hidden-mobile');
          if (dragHandle) dragHandle.classList.add('hidden-mobile');
          toggleButton.textContent = '⚙️';
        }
      });
    }
    
    // Setup draggable bottom sheet
    if (dragHandle) {
      // Set initial height explicitly
      gui.domElement.style.maxHeight = '35vh';
      const children = gui.domElement.querySelector('.children') as HTMLElement;
      if (children) {
        children.style.maxHeight = 'calc(35vh - 40px)';
      }
      
      let isDragging = false;
      let startY = 0;
      let startHeight = 0;
      const minHeight = 15; // 15vh minimum
      const maxHeight = 70; // 70vh maximum
      
      const handleTouchStart = (e: TouchEvent) => {
        isDragging = true;
        startY = e.touches[0].clientY;
        // Get computed style to read actual CSS value
        const computedStyle = window.getComputedStyle(gui.domElement);
        const currentMaxHeight = gui.domElement.style.maxHeight || computedStyle.maxHeight;
        // Extract numeric value from string like "232.4px" or "35vh"
        if (currentMaxHeight.endsWith('vh')) {
          startHeight = parseFloat(currentMaxHeight);
        } else if (currentMaxHeight.endsWith('px')) {
          // Convert px to vh
          const px = parseFloat(currentMaxHeight);
          startHeight = (px / window.innerHeight) * 100;
        } else {
          startHeight = 35; // fallback to default
        }
        console.log('Drag start - height:', startHeight + 'vh');
      };
      
      const handleTouchMove = (e: TouchEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        
        const currentY = e.touches[0].clientY;
        const deltaY = startY - currentY;
        const viewportHeight = window.innerHeight;
        const deltaVh = (deltaY / viewportHeight) * 100;
        
        let newHeight = startHeight + deltaVh;
        newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
        
        gui.domElement.style.maxHeight = `${newHeight}vh`;
        const children = gui.domElement.querySelector('.children') as HTMLElement;
        if (children) {
          children.style.maxHeight = `calc(${newHeight}vh - 40px)`;
        }
      };
      
      const handleTouchEnd = () => {
        isDragging = false;
        console.log('Drag ended - final height:', gui.domElement.style.maxHeight);
      };
      
      dragHandle.addEventListener('touchstart', handleTouchStart, { passive: false });
      dragHandle.addEventListener('touchmove', handleTouchMove, { passive: false });
      dragHandle.addEventListener('touchend', handleTouchEnd);
      dragHandle.addEventListener('touchcancel', handleTouchEnd);
    }
  }
  
  console.log('✨ Simulation ready!');
  const particleCount = params.mode === '4d-wave' 
    ? Math.pow(params.gridSize, 4)
    : Math.pow(params.gridSize, 3);
  console.log('📊 Grid size:', params.gridSize, '(', particleCount, 'particles)');
  console.log('🎨 Mode:', params.mode);
  if (isMobile) {
    console.log('📱 Mobile device detected - orientation controls available');
  }
}

// Start the application
init();

