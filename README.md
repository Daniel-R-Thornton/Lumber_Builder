# Lumber Builder

A 3D lumber framing design tool built with React Three Fiber. Design timber frames, add joints and fasteners, generate cutlists and BOMs.

## Features

- **3D Scene** — Orbit, pan, zoom. Perspective or orthographic camera.
- **Lumber Library** — US dimensional (2×4, 2×6, etc.) and AUS metric (90×45, 140×45, etc.) profiles.
- **Piece Manipulation** — Translate (T), Rotate (R), Resize (E) with TransformControls and snap-to-grid.
- **Smart Snapping** — Face-to-face snap with collision detection, end-to-end alignment, and auto joint creation.
- **Joint Tool (N)** — Click two pieces to manually add screw/nail/bolt/bracket joints with configurable spacing.
- **Measure Tool (M)** — Click two piece vertices to add dimension annotations. Edit values to reposition pieces.
- **Cutlist & BOM** — Export CSV cutlist, view material costs and hardware tally.
- **Undo/Redo** — 50-step history (Ctrl+Z / Ctrl+Shift+Z).
- **Save/Load** — JSON project files with full state serialization.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:20031

## Controls

| Key | Action |
|-----|--------|
| `T` | Translate mode |
| `R` | Rotate mode |
| `E` | Resize mode |
| `M` | Measure tool |
| `N` | Drill/joint tool |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+D` | Duplicate selected |
| `Delete` | Remove selected |

## Tech Stack

- React 19 + TypeScript
- Three.js + @react-three/fiber + @react-three/drei
- Zustand (state management)
- Tailwind CSS v4
- Vite
