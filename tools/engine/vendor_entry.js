/**
 * The vendored Babylon surface for the AMG World Engine.
 *
 * WHY THIS FILE EXISTS. The hub is a static site — `python -m http.server` in
 * dev, push-to-deploy in prod, no bundler anywhere. Babylon's ES6 packages are
 * thousands of small modules, so they cannot be loaded through an import map
 * the way three.js is. The options were a ~6 MB UMD bundle from the CDN or a
 * tree-shaken bundle built once and committed. This is the second: engine
 * source stays hand-written ESM the browser loads directly (no build, no
 * watch, edit-and-refresh), and only the dependency is prebuilt.
 *
 * IMPORT DEEP, NOT FROM THE BARREL. `@babylonjs/core` re-exports everything
 * and drags the whole engine in. Every import below is a deep path so esbuild
 * can drop what the park never uses. Some are side-effect-only: Babylon
 * augments Mesh's prototype from separate modules (thin instances are the one
 * that matters here), and the glTF loader registers itself with SceneLoader.
 *
 * Rebuild with:  cd tools/engine && npm install && npm run vendor
 * Output (COMMITTED, so deploys need no build): engine/vendor/
 */

// ── side effects: prototype augmentation and registrations ─────────────────
import "@babylonjs/core/Meshes/thinInstanceMesh.js"; // Mesh.thinInstance* — the park is built on these
import "@babylonjs/core/Culling/ray.js"; // scene.pick / createPickingRay
import "@babylonjs/core/Rendering/boundingBoxRenderer.js"; // showBoundingBox, used by the object layer
import "@babylonjs/core/Animations/animatable.js"; // scene.beginAnimation, AnimationGroup playback
/**
 * The glTF loader, and ONLY the extensions our assets declare.
 *
 * `glTF/2.0/index.js` registers all ~40 extensions, which drags in gaussian
 * splatting, meshopt, avif, variants and the rest — about 700 KB of code for
 * files that never use them. The park GLB declares KHR_draco_mesh_compression
 * (required), KHR_materials_specular and KHR_materials_ior; the kid GLBs
 * declare EXT_texture_webp (required). If a future export adds an extension,
 * the loader logs a warning naming it — add the import here.
 */
import "@babylonjs/loaders/glTF/glTFFileLoader.js";
import "@babylonjs/loaders/glTF/2.0/glTFLoader.js";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_draco_mesh_compression.js";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_specular.js";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_ior.js";
import "@babylonjs/loaders/glTF/2.0/Extensions/EXT_texture_webp.js";
// `DracoDecoder` (not DracoCompression) is what KHR_draco_mesh_compression
// reads — via DracoDecoder.Default / .DefaultConfiguration. boot.js repoints
// that configuration at engine/vendor/draco/ so nothing is fetched from
// cdn.babylonjs.com at runtime.
export { DracoDecoder } from "@babylonjs/core/Meshes/Compression/dracoDecoder.js";

// ── engine / scene ────────────────────────────────────────────────────────
export { Engine } from "@babylonjs/core/Engines/engine.js";
export { Scene } from "@babylonjs/core/scene.js";
export { SceneLoader } from "@babylonjs/core/Loading/sceneLoader.js";
export { AssetContainer } from "@babylonjs/core/assetContainer.js";
export { Observable } from "@babylonjs/core/Misc/observable.js";
export { Tools } from "@babylonjs/core/Misc/tools.js";

// ── maths ─────────────────────────────────────────────────────────────────
export { Vector2, Vector3, Vector4, Quaternion, Matrix } from "@babylonjs/core/Maths/math.vector.js";
export { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
export { Axis, Space } from "@babylonjs/core/Maths/math.axis.js";
export { Scalar } from "@babylonjs/core/Maths/math.scalar.js";
export { Epsilon } from "@babylonjs/core/Maths/math.constants.js";

// ── cameras ───────────────────────────────────────────────────────────────
export { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
export { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera.js";
export { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import "@babylonjs/core/Cameras/Inputs/freeCameraKeyboardMoveInput.js";
import "@babylonjs/core/Cameras/Inputs/freeCameraMouseInput.js";
import "@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput.js";
import "@babylonjs/core/Cameras/Inputs/arcRotateCameraKeyboardMoveInput.js";

// ── lights and shadows ────────────────────────────────────────────────────
export { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
export { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
export { PointLight } from "@babylonjs/core/Lights/pointLight.js";
export { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";

// ── meshes and geometry ───────────────────────────────────────────────────
export { Mesh } from "@babylonjs/core/Meshes/mesh.js";
export { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
export { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
export { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
export { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
export { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
export { BoundingInfo } from "@babylonjs/core/Culling/boundingInfo.js";
export { BoundingBox } from "@babylonjs/core/Culling/boundingBox.js";
export { Ray } from "@babylonjs/core/Culling/ray.js";
export { PickingInfo } from "@babylonjs/core/Collisions/pickingInfo.js";

// ── materials ─────────────────────────────────────────────────────────────
// The park ships NO textures — the Synty atlas is baked to vertex colours — so
// StandardMaterial is the whole lighting model here. PBRMaterial is not
// exported on purpose: it and its OpenPBR/BRDF tables are ~250 KB, and the
// glTF loader only instantiates one if a material needs it (the kids' single
// textured material does, which is why pbrMaterial still ends up bundled).
export { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
export { Material } from "@babylonjs/core/Materials/material.js";
export { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration.js";
export { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
export { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
export { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture.js";

// ── skeletal animation ────────────────────────────────────────────────────
export { Skeleton } from "@babylonjs/core/Bones/skeleton.js";
export { Bone } from "@babylonjs/core/Bones/bone.js";
export { BoneIKController } from "@babylonjs/core/Bones/boneIKController.js";
export { BoneLookController } from "@babylonjs/core/Bones/boneLookController.js";
export { Animation } from "@babylonjs/core/Animations/animation.js";
export { AnimationGroup } from "@babylonjs/core/Animations/animationGroup.js";
export { AnimationEvent } from "@babylonjs/core/Animations/animationEvent.js";
export { Animatable } from "@babylonjs/core/Animations/animatable.js";

// ── physics v2 (Havok) ────────────────────────────────────────────────────
export { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin.js";
export { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody.js";
export { PhysicsShape, PhysicsShapeBox, PhysicsShapeSphere, PhysicsShapeCapsule, PhysicsShapeMesh, PhysicsShapeConvexHull, PhysicsShapeContainer } from "@babylonjs/core/Physics/v2/physicsShape.js";
export { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate.js";
export { PhysicsMotionType, PhysicsShapeType, PhysicsConstraintType, PhysicsConstraintAxis, PhysicsPrestepType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin.js";
export { PhysicsConstraint, Physics6DoFConstraint, HingeConstraint, LockConstraint } from "@babylonjs/core/Physics/v2/physicsConstraint.js";
export { PhysicsCharacterController, CharacterSupportedState } from "@babylonjs/core/Physics/v2/characterController.js";
export { PhysicsViewer } from "@babylonjs/core/Debug/physicsViewer.js";
import "@babylonjs/core/Physics/physicsEngineComponent.js";
import "@babylonjs/core/Physics/v2/physicsEngineComponent.js";

// ── misc runtime bits the park uses ───────────────────────────────────────
export { Sound } from "@babylonjs/core/Audio/sound.js";
export { UtilityLayerRenderer } from "@babylonjs/core/Rendering/utilityLayerRenderer.js";
export { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents.js";
export { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents.js";

/** False in the student bundle; the dev bundle overrides it to true. */
export const HAS_INSPECTOR = false;
