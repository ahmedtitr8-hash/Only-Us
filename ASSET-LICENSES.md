# عالمنا — الأصول

## 1) Xbot character
- File: loaded remotely at runtime from `https://threejs.org/examples/models/gltf/Xbot.glb`
- Source: Three.js examples
- Use: player character + built-in animations
- Note: no real-person face is used.

## 2) Living room model (active room, replaces the old procedural box room)
- File: bundled locally at `worlds/worlds/living-room/assets/living-room.glb` (~9 MB, glTF-Binary, embedded PNG textures)
- Provided by: uploaded directly by the project owner (filenames/structure match a
  typical Sketchfab "Modern Living Room" download bundle: FBX source + separate
  `_c`/`_r` texture maps, converted here to a single .glb for the web).
- **License not verified by this tool.** No license/readme file was included in the
  uploaded bundle. Before publishing this site publicly (or using it commercially),
  confirm you have the rights to redistribute this exact model — e.g. check the
  original Sketchfab listing page for its license (CC-BY, royalty-free store license,
  personal-use only, etc.) and keep/attach that attribution here if required.
- Use: the entire "سوا" (living-room) world — floor/walls/ceiling ("Structure"),
  sofa, coffee table, TV + stand, floor lamp, plant, windows, picture frame, pillows.
  Collision boxes, the sit point on the sofa, the TV on/off interaction, and spawn
  points are all derived automatically at runtime from this model's named parts (see
  `worlds/worlds/living-room/scene.js`) — nothing about the room is hand-built anymore.

## Removed
The previous procedural (box-built) kitchen/living-room scenes have been fully
deleted from the active "سوا" world per the project owner's request. The old
`worlds/worlds/kitchen/scene.js` file is kept only as an inactive, unreferenced
archive (`available: false` in `worlds/config.js`) — it is not loaded or shown
anywhere in the app.

## Offline / size note
The living-room GLB is loaded locally now (not fetched from a public CDN), so it
must actually be committed to the repository/deployment for the world to load —
if the file goes missing at deploy time, the app shows a bare floor+walls safety
room instead of a blank screen (see the top of `scene.js`).
