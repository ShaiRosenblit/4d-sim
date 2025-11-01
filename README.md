# 4D Wave Simulation

An interactive 3D web application that visualizes a 4D wave effect projected into 3D space, inspired by [QRI's 4D Wave Control demo](https://qri.org/demo/4d_wave_control.html).

![4D Wave Simulation](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

## 🌟 Features

- **4D Rotation Visualization**: Points rotate simultaneously in XY and ZW planes
- **Real-time 4D → 3D Projection**: Hyperdimensional geometry projected to 3D space
- **Interactive Controls**: Mouse-based orbit controls for desktop navigation
- **Parameter Tweaking**: Real-time GUI sliders for rotation speeds, colors, and more
- **8,000 Particles**: Efficient instanced rendering with custom GLSL shaders
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
- **XY Speed**: Rotation speed in the XY plane (0-2)
- **ZW Speed**: Rotation speed in the ZW plane (0-2)
- **Spread**: Spatial distribution of particles (1-10)
- **Color Intensity**: Brightness of particle colors (0-2)
- **Color Animation**: Speed of color cycling/pulsing (0-2)
- **Projection**: 4D projection factor (0-2)
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

1. **4D Geometry System**
   - Generates a 20×20×20 lattice in 4D space
   - Fourth dimension (W) calculated using wave patterns

2. **Rotation Engine**
   - Independent rotation matrices for XY and ZW planes
   - Implemented in GLSL vertex shader for GPU acceleration

3. **Projection System**
   - Perspective projection from 4D to 3D: `vec3(x,y,z) / (1 + w * factor)`
   - Creates depth-like effect for the 4th dimension

4. **Rendering Pipeline**
   - Three.js Points system with custom ShaderMaterial
   - Additive blending for glow effects
   - Dynamic coloring based on 4D position

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

## 🧮 Mathematical Background

This simulation visualizes a 4D rotation by:

1. **4D Rotation Matrices**: Applies Givens rotations in orthogonal planes:
   - XY plane: Standard 2D rotation
   - ZW plane: Independent 2D rotation

2. **Stereographic Projection**: Projects 4D points to 3D using perspective division

3. **Wave Function**: The W coordinate is initialized using:
   ```
   w = sin(πx) × sin(πy) × sin(πz)
   ```

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

Inspired by the [QRI 4D Wave Control demo](https://qri.org/demo/4d_wave_control.html) and the fascinating world of higher-dimensional mathematics.

---

**Built with ❤️ using Three.js, TypeScript, and WebGL2**

