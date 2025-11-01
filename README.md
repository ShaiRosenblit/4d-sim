# 4D Simulation - Wave & Indra's Net

An interactive 3D web application featuring two distinct visualization modes:
1. **4D Wave**: Visualizes 4D wave patterns projected into 3D space, inspired by [QRI's 4D Wave Control demo](https://qri.org/demo/4d_wave_control.html)
2. **Indra's Net**: A network of mirror-like particles reflecting colored lights, inspired by the Buddhist metaphor of [Indra's Net](https://en.wikipedia.org/wiki/Indra%27s_net)

![4D Wave Simulation](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

## 🌟 Features

### 4D Wave Mode
- **4D Rotation Visualization**: Points rotate simultaneously in XY and ZW planes
- **Real-time 4D → 3D Projection**: Hyperdimensional geometry projected to 3D space
- **Dynamic Color Animation**: Colors based on 4D position
- **Adjustable Parameters**: Control rotation speeds, projection, spread, and more

### Indra's Net Mode
- **Mirror-Like Particles**: Each particle reflects light like a jewel
- **Animated Light Sources**: Three colored lights orbit through space
- **Chromatic Aberration**: Jewel-like reflections with color dispersion
- **Interconnected Visualization**: Demonstrates the Buddhist concept of mutual reflection

### Common Features
- **Interactive Controls**: Mouse-based orbit controls for desktop navigation
- **Parameter Tweaking**: Real-time GUI sliders for extensive customization
- **Adjustable Particle Count**: From 50 to 8,000 particles (applies to both modes)
- **WebXR Ready**: Structured for easy extension to VR mode (Quest 3)
- **Photosensitivity Warning**: Built-in safety overlay

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will automatically open in your browser at `http://localhost:3000`.

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build
npm run preview
```

## 🎮 Controls

### Mouse Controls
- **Left Click + Drag**: Rotate camera around the scene
- **Right Click + Drag**: Pan camera
- **Scroll Wheel**: Zoom in/out

### GUI Parameters

#### Mode Selection
- **Mode**: Switch between '4d-wave' and 'indras-net' modes
- **Particle Count**: Number of particles to render (50-8000)

#### 4D Wave Mode Parameters
- **XY Speed**: Rotation speed in the XY plane (0-2)
- **ZW Speed**: Rotation speed in the ZW plane (0-2)
- **Spread**: Spatial distribution of particles (1-10)
- **Color Intensity**: Brightness of particle colors (0-2)
- **Color Animation**: Speed of color cycling/pulsing (0-2)
- **Projection**: 4D projection factor (0-2)

#### Indra's Net Mode Parameters
- **Reflection Strength**: Intensity of mirror reflections (0-2)
- **Reflection Range**: Distance over which reflections occur (1-10)
- **Light Intensity**: Brightness of light sources (0-3)
- **Light Speed**: Speed of orbiting lights (0-2)

#### Common Parameters
- **Sharpness**: Particle edge definition (0-1)
- **Opacity**: Particle transparency (0-1)
- **Blending Mode**: Rendering blend mode (Normal/Additive/etc.)
- **Time Scale**: Overall animation speed (0-3)

## 🏗️ Architecture

### File Structure

```
4d-sim/
├── src/
│   └── main.ts          # Main application code
├── index.html           # HTML entry point
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── vite.config.ts       # Vite config
└── README.md
```

### Key Components

#### 4D Wave Mode
1. **4D Geometry System**
   - Generates a dynamic lattice in 4D space
   - Fourth dimension (W) calculated using wave patterns

2. **Rotation Engine**
   - Independent rotation matrices for XY and ZW planes
   - Implemented in GLSL vertex shader for GPU acceleration

3. **Projection System**
   - Perspective projection from 4D to 3D: `vec3(x,y,z) / (1 + w * factor)`
   - Creates depth-like effect for the 4th dimension

#### Indra's Net Mode
1. **Mirror Particle System**
   - Static 3D grid of reflective particles
   - Each particle acts as a mirror surface

2. **Light Source System**
   - Three colored light sources (red, green, blue)
   - Orbiting in complex 3D patterns

3. **Reflection Shader**
   - Calculates light reflection on each particle
   - Chromatic aberration for jewel-like appearance
   - Specular highlights for mirror effect

#### Common Systems
- **Rendering Pipeline**: Three.js Points system with custom ShaderMaterial
- **GUI System**: Real-time parameter controls with lil-gui
- **Camera System**: Orbit controls with optional device orientation support

## 🔮 Future Enhancements

### WebXR VR Support (Quest 3)

The codebase is structured for easy WebXR integration:

```typescript
// Uncomment these lines in main.ts:
// import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
// renderer.xr.enabled = true;
// document.body.appendChild(VRButton.createButton(renderer));

// Replace animate() call with:
// renderer.setAnimationLoop(animate);
```

### Additional Ideas
- Multiple particle systems with different rotation patterns
- Audio reactivity
- Save/load parameter presets
- Recording/screenshot functionality
- More complex 4D shapes (tesseracts, 120-cell, etc.)

## 🧮 Mathematical & Conceptual Background

### 4D Wave Mode

Visualizes 4D rotation by:

1. **4D Rotation Matrices**: Applies Givens rotations in orthogonal planes:
   - XY plane: Standard 2D rotation
   - ZW plane: Independent 2D rotation

2. **Stereographic Projection**: Projects 4D points to 3D using perspective division

3. **Wave Function**: The W coordinate is initialized using:
   ```
   w = sin(πx) × sin(πy) × sin(πz)
   ```

### Indra's Net Mode

Based on the Buddhist metaphor from the Avatamsaka Sutra:

> "In the heaven of Indra, there is said to be a network of pearls, so arranged that if you look at one you see all the others reflected in it. In the same way each object in the world is not merely itself but involves every other object and in fact IS everything else."

The visualization demonstrates:
- **Interconnectedness**: Each particle reflects all others
- **Mutual causation**: Light from one source affects all particles
- **Infinite reflection**: The concept of jewels infinitely reflecting each other

## 📦 Dependencies

- **three** (^0.160.0): 3D rendering engine
- **lil-gui** (^0.19.2): Parameter controls
- **typescript** (^5.3.3): Type-safe development
- **vite** (^5.0.11): Fast build tool

## 🛡️ Safety

This application includes a photosensitivity warning overlay due to flashing lights and rapidly changing colors. Users with photosensitive epilepsy should exercise caution.

## 📄 License

MIT License - feel free to use and modify as needed.

## 🙏 Acknowledgments

- **4D Wave Mode**: Inspired by the [QRI 4D Wave Control demo](https://qri.org/demo/4d_wave_control.html) and the fascinating world of higher-dimensional mathematics
- **Indra's Net Mode**: Inspired by the Buddhist metaphor from the [Avatamsaka Sutra](https://en.wikipedia.org/wiki/Indra%27s_net) and the concept of universal interconnectedness

---

**Built with ❤️ using Three.js, TypeScript, and WebGL2**

