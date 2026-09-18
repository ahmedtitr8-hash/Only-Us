# عالمنا — الأصول

## 1) Xbot character
- File: loaded remotely at runtime from `https://threejs.org/examples/models/gltf/Xbot.glb`
- Source: Three.js examples
- Use: player character + built-in animations
- Note: no real-person face is used.

## 2) SheenChair
- File: loaded remotely at runtime from `https://threejs.org/examples/models/gltf/SheenChair.glb`
- Source: Three.js examples
- Use: additional real GLB furniture asset.

## Important
The two GLB assets above are intentionally loaded lazily from public HTTPS URLs so the GitHub Pages package does not become unnecessarily large. If you later want the project to work fully offline, download approved copies and place them under `worlds/worlds/living-room/assets/`, then switch the URLs to local paths.
