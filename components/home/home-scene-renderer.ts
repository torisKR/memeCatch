import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import {
  createHomeStudioArtwork,
  HomeStudioResourceTracker,
} from "@/components/home/home-studio-artwork";
import {
  HOME_SCENE_LAYOUT_POSES,
  type HomeSceneLayout,
  type HomeSceneLayoutObjectName,
} from "@/lib/home-scene-layout";
import type { SafetyLevel } from "@/lib/labels";

export type { HomeSceneLayout } from "@/lib/home-scene-layout";

export type HomeSceneRendererOptions = {
  layoutMode?: HomeSceneLayout;
  maxPixelRatio?: number;
  onContextLost?: () => void;
  onSignalSelect?: (level: SafetyLevel) => void;
  paused?: boolean;
  scrollProgress?: number | null;
  selectedSignal?: SafetyLevel;
};

export type HomeSceneRendererController = {
  dispose: () => void;
  resetView: () => void;
  setLayoutMode: (mode: HomeSceneLayout) => void;
  setPaused: (paused: boolean) => void;
  setScrollProgress: (progress: number | null) => void;
  setSelectedSignal: (level: SafetyLevel) => void;
};

const MAX_VIEW_PITCH = 0.2;
const MAX_VIEW_YAW = 0.48;
const DRAG_THRESHOLD = 6;
const VIEW_DAMPING = 12;
const LAYOUT_DAMPING = 7;
const DAMPING_EPSILON = 0.0005;
const SCROLL_VIEW_YAW = 0.1;
const SCROLL_VIEW_PITCH = 0.06;

function normalizeInitialScrollProgress(progress: number | null | undefined) {
  return typeof progress === "number" && Number.isFinite(progress)
    ? THREE.MathUtils.clamp(progress, 0, 1)
    : null;
}

function scrollViewPose(progress: number) {
  return {
    pitch: Math.sin(progress * Math.PI) * SCROLL_VIEW_PITCH - 0.025,
    yaw: THREE.MathUtils.lerp(-SCROLL_VIEW_YAW, SCROLL_VIEW_YAW, progress),
  };
}

function fitCameraToBox(
  camera: THREE.PerspectiveCamera,
  box: THREE.Box3,
  aspect: number,
) {
  camera.aspect = aspect;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const distance = Math.max(
    size.y / (2 * verticalTangent),
    size.x / (2 * verticalTangent * aspect),
  ) * 1.1 + size.z / 2;
  const radius = size.length() / 2;

  camera.position.set(center.x, center.y, center.z + distance);
  camera.near = Math.max(0.1, distance - radius * 1.35);
  camera.far = distance + radius * 2.25;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

export function mountHomeScene(
  host: HTMLElement,
  {
    layoutMode: initiallyLayoutMode = "stacked",
    maxPixelRatio = 1.5,
    onContextLost,
    onSignalSelect,
    paused: initiallyPaused = false,
    scrollProgress: initiallyScrollProgress = null,
    selectedSignal: initiallySelectedSignal = "green",
  }: HomeSceneRendererOptions = {},
): HomeSceneRendererController {
  const scene = new THREE.Scene();
  const resources = new HomeStudioResourceTracker();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
    premultipliedAlpha: true,
  });

  let disposed = false;
  let paused = initiallyPaused;
  let frameId: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let resize: (() => void) | null = null;
  let usingWindowResize = false;
  let handleContextLost: ((event: Event) => void) | null = null;
  let removeInteractionListeners: (() => void) | null = null;
  let releaseActivePointer: (() => void) | null = null;
  let environmentTarget: THREE.WebGLRenderTarget | null = null;

  const stopLoop = () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
  };

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    stopLoop();
    releaseActivePointer?.();
    removeInteractionListeners?.();
    resizeObserver?.disconnect();
    if (usingWindowResize && resize) window.removeEventListener("resize", resize);
    if (handleContextLost) {
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
    }

    scene.environment = null;
    environmentTarget?.dispose();
    environmentTarget = null;

    try {
      resources.dispose();
    } finally {
      scene.clear();
      try {
        renderer.dispose();
      } finally {
        try {
          renderer.forceContextLoss();
        } finally {
          renderer.domElement.remove();
        }
      }
    }
  };

  try {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;
    renderer.domElement.dataset.homeSceneCanvas = "true";
    Object.assign(renderer.domElement.style, {
      display: "block",
      height: "100%",
      inset: "0",
      position: "absolute",
      touchAction: "pan-y pinch-zoom",
      width: "100%",
    });
    host.replaceChildren(renderer.domElement);

    const roomEnvironment = new RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    try {
      environmentTarget = pmremGenerator.fromScene(
        roomEnvironment,
        0.035,
        0.1,
        100,
        { size: 64 },
      );
      scene.environment = environmentTarget.texture;
      scene.environmentIntensity = 0.45;
    } finally {
      roomEnvironment.dispose();
      pmremGenerator.dispose();
    }

    const ambientLight = new THREE.HemisphereLight(0xf7f4ed, 0x34363a, 0.38);
    ambientLight.name = "studio-ambient-light";
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffbf3, 1.35);
    keyLight.name = "studio-key-light";
    keyLight.position.set(-4.6, 5.4, 7.8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe8edf2, 0.55);
    fillLight.name = "studio-fill-light";
    fillLight.position.set(5.2, 0.8, 4.4);
    scene.add(fillLight);

    const stageRoot = new THREE.Group();
    stageRoot.name = "interactive-sculptural-stage";
    stageRoot.rotation.order = "YXZ";
    scene.add(stageRoot);

    const {
      artwork,
      heroAssembly,
      layoutObjects,
      tokens,
    } = createHomeStudioArtwork(resources);
    stageRoot.add(artwork);

    let selectedSignal = initiallySelectedSignal;
    let layoutMode = initiallyLayoutMode;
    let scrollTarget = normalizeInitialScrollProgress(initiallyScrollProgress);
    let scrollControlled = scrollTarget !== null;
    let layoutProgress = scrollTarget ?? (layoutMode === "spread" ? 1 : 0);
    let viewYawTarget = 0;
    let viewPitchTarget = 0;
    let viewYaw = 0;
    let viewPitch = 0;
    let hoverYawTarget = 0;
    let hoverPitchTarget = 0;
    let hoverYaw = 0;
    let hoverPitch = 0;
    let elapsed = 0;
    const layoutObjectNames = Object.keys(
      HOME_SCENE_LAYOUT_POSES.stacked,
    ) as HomeSceneLayoutObjectName[];

    const applyArtworkTransforms = (motionEnabled: boolean) => {
      layoutObjectNames.forEach((name) => {
        const object = layoutObjects[name];
        const stacked = HOME_SCENE_LAYOUT_POSES.stacked[name];
        const spread = HOME_SCENE_LAYOUT_POSES.spread[name];
        object.position.set(
          THREE.MathUtils.lerp(stacked.position[0], spread.position[0], layoutProgress),
          THREE.MathUtils.lerp(stacked.position[1], spread.position[1], layoutProgress),
          THREE.MathUtils.lerp(stacked.position[2], spread.position[2], layoutProgress),
        );
        object.rotation.set(
          THREE.MathUtils.lerp(stacked.rotation[0], spread.rotation[0], layoutProgress),
          THREE.MathUtils.lerp(stacked.rotation[1], spread.rotation[1], layoutProgress),
          THREE.MathUtils.lerp(stacked.rotation[2], spread.rotation[2], layoutProgress),
        );
      });

      const motionAmount = motionEnabled ? 1 : 0;
      heroAssembly.position.y = heroAssembly.userData.baseY
        + Math.sin(elapsed * 0.5) * 0.035 * motionAmount;
      heroAssembly.rotation.y = Math.sin(elapsed * 0.38) * 0.035 * motionAmount;
      heroAssembly.rotation.x = Math.sin(elapsed * 0.31) * 0.012 * motionAmount;
      tokens.forEach((token) => {
        token.position.y += Math.sin(elapsed * 0.58 + token.userData.phase)
          * 0.035 * motionAmount;
        token.rotation.z += Math.sin(elapsed * 0.46 + token.userData.phase)
          * 0.045 * motionAmount;
      });

      renderer.domElement.dataset.layoutMode = layoutMode;
      renderer.domElement.dataset.layoutProgress = layoutProgress.toFixed(3);
      renderer.domElement.dataset.scrollControlled = String(scrollControlled);
      renderer.domElement.dataset.scrollProgress = layoutProgress.toFixed(3);
      renderer.domElement.dataset.scrollTarget = scrollTarget?.toFixed(3) ?? "";
    };

    const syncViewTransform = () => {
      const scrollPose = scrollControlled
        ? scrollViewPose(layoutProgress)
        : { pitch: 0, yaw: 0 };
      const nextYaw = THREE.MathUtils.clamp(
        viewYaw + hoverYaw + scrollPose.yaw,
        -MAX_VIEW_YAW,
        MAX_VIEW_YAW,
      );
      const nextPitch = THREE.MathUtils.clamp(
        viewPitch + hoverPitch + scrollPose.pitch,
        -MAX_VIEW_PITCH,
        MAX_VIEW_PITCH,
      );
      stageRoot.rotation.y = nextYaw;
      stageRoot.rotation.x = nextPitch;
      renderer.domElement.dataset.viewYaw = nextYaw.toFixed(3);
      renderer.domElement.dataset.viewPitch = nextPitch.toFixed(3);
      stageRoot.updateMatrixWorld(true);
    };

    const syncSceneTransforms = () => {
      applyArtworkTransforms(!paused);
      syncViewTransform();
    };

    const syncSelectionVisuals = () => {
      renderer.domElement.dataset.selectedSignal = selectedSignal;

      tokens.forEach((token) => {
        const isSelected = token.userData.signalLevel === selectedSignal;
        const face = token.userData.face as THREE.Mesh<
          THREE.CircleGeometry,
          THREE.MeshPhysicalMaterial
        >;
        const selectionRing = token.userData.selectionRing as THREE.Mesh;
        token.scale.setScalar(isSelected ? 1.13 : 1);
        face.material.emissiveIntensity = isSelected ? 0.18 : 0.015;
        selectionRing.visible = isSelected;
      });
    };

    syncSelectionVisuals();
    syncSceneTransforms();

    const framingBox = new THREE.Box3();
    tokens.forEach((token) => token.scale.setScalar(1.13));
    for (const sampleProgress of [0, 0.25, 0.5, 0.75, 1]) {
      layoutProgress = sampleProgress;
      for (const yaw of [-MAX_VIEW_YAW, 0, MAX_VIEW_YAW]) {
        for (const pitch of [-MAX_VIEW_PITCH, 0, MAX_VIEW_PITCH]) {
          stageRoot.rotation.set(pitch, yaw, 0);
          applyArtworkTransforms(false);
          stageRoot.updateMatrixWorld(true);
          framingBox.expandByObject(stageRoot);
        }
      }
    }
    framingBox.expandByScalar(0.1);
    layoutProgress = scrollTarget ?? (layoutMode === "spread" ? 1 : 0);
    viewYaw = 0;
    viewPitch = 0;
    hoverYaw = 0;
    hoverPitch = 0;
    syncSelectionVisuals();
    syncSceneTransforms();

    let previousTime = performance.now();

    const renderFrame = (time: number) => {
      frameId = null;
      if (disposed || paused) return;
      const delta = Math.max((time - previousTime) / 1000, 0);
      previousTime = time;
      elapsed += delta;

      const layoutTarget = scrollTarget ?? (layoutMode === "spread" ? 1 : 0);
      layoutProgress = THREE.MathUtils.damp(
        layoutProgress,
        layoutTarget,
        LAYOUT_DAMPING,
        delta,
      );
      if (Math.abs(layoutProgress - layoutTarget) < DAMPING_EPSILON) {
        layoutProgress = layoutTarget;
      }
      viewYaw = THREE.MathUtils.damp(viewYaw, viewYawTarget, VIEW_DAMPING, delta);
      viewPitch = THREE.MathUtils.damp(viewPitch, viewPitchTarget, VIEW_DAMPING, delta);
      hoverYaw = THREE.MathUtils.damp(hoverYaw, hoverYawTarget, VIEW_DAMPING, delta);
      hoverPitch = THREE.MathUtils.damp(hoverPitch, hoverPitchTarget, VIEW_DAMPING, delta);

      syncSceneTransforms();
      renderer.render(scene, camera);
      if (!disposed && !paused) frameId = requestAnimationFrame(renderFrame);
    };

    const renderStill = () => {
      if (disposed) return;
      syncSceneTransforms();
      renderer.render(scene, camera);
    };

    const renderManualChange = () => {
      if (!paused) return;
      if (!scrollControlled) {
        layoutProgress = layoutMode === "spread" ? 1 : 0;
      }
      viewYaw = viewYawTarget;
      viewPitch = viewPitchTarget;
      hoverYaw = 0;
      hoverPitch = 0;
      renderStill();
    };

    const startLoop = () => {
      if (disposed || paused || frameId !== null) return;
      previousTime = performance.now();
      frameId = requestAnimationFrame(renderFrame);
    };

    resize = () => {
      if (disposed) return;
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      fitCameraToBox(camera, framingBox, width / height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio, 1.5));
      renderer.setSize(width, height, false);
      renderStill();
    };

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const tokenSet = new Set<THREE.Object3D>(tokens);

    const signalForObject = (object: THREE.Object3D) => {
      let current: THREE.Object3D | null = object;
      while (current && !tokenSet.has(current)) current = current.parent;
      return current?.userData.signalLevel as SafetyLevel | undefined;
    };

    const pickSignal = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return undefined;
      pointerNdc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      syncViewTransform();
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(pointerNdc, camera);
      const intersection = raycaster.intersectObjects(scene.children, true)
        .find(({ object, face }) => {
          for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
            if (!ancestor.visible) return false;
          }
          if (!(object instanceof THREE.Mesh)) return false;
          const material = Array.isArray(object.material)
            ? object.material[face?.materialIndex ?? 0]
            : object.material;
          return Boolean(material?.visible && material.opacity > 0);
        });
      return intersection ? signalForObject(intersection.object) : undefined;
    };

    const selectSignal = (level: SafetyLevel, notify: boolean) => {
      if (disposed) return;
      selectedSignal = level;
      syncSelectionVisuals();
      renderManualChange();
      if (notify) onSignalSelect?.(level);
    };

    type ActivePointer = {
      dragged: boolean;
      pointerId: number;
      pointerType: string;
      startPitch: number;
      startX: number;
      startY: number;
      startYaw: number;
      verticalScrollIntent: boolean;
    };
    let activePointer: ActivePointer | null = null;

    const releasePointerCapture = (pointerId: number) => {
      try {
        if (renderer.domElement.hasPointerCapture?.(pointerId)) {
          renderer.domElement.releasePointerCapture(pointerId);
        }
      } catch {
        // Capture can already be gone after a native cancel/lost-capture event.
      }
    };

    releaseActivePointer = () => {
      if (!activePointer) return;
      const { pointerId } = activePointer;
      activePointer = null;
      releasePointerCapture(pointerId);
    };

    const clearHover = () => {
      hoverYawTarget = 0;
      hoverPitchTarget = 0;
      if (paused) {
        hoverYaw = 0;
        hoverPitch = 0;
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (disposed || !event.isPrimary || event.button !== 0) return;
      clearHover();
      activePointer = {
        dragged: false,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startPitch: viewPitchTarget,
        startX: event.clientX,
        startY: event.clientY,
        startYaw: viewYawTarget,
        verticalScrollIntent: false,
      };
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Interaction still works without capture in older embedded browsers.
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (disposed) return;
      if (activePointer?.pointerId === event.pointerId) {
        const deltaX = event.clientX - activePointer.startX;
        const deltaY = event.clientY - activePointer.startY;
        const distance = Math.hypot(deltaX, deltaY);

        if (activePointer.verticalScrollIntent) return;
        if (!activePointer.dragged) {
          if (distance < DRAG_THRESHOLD) return;
          if (
            activePointer.pointerType === "touch"
            && Math.abs(deltaY) > Math.abs(deltaX)
          ) {
            activePointer.verticalScrollIntent = true;
            return;
          }
          activePointer.dragged = true;
        }

        viewYawTarget = THREE.MathUtils.clamp(
          activePointer.startYaw + deltaX * 0.006,
          -MAX_VIEW_YAW,
          MAX_VIEW_YAW,
        );
        viewPitchTarget = THREE.MathUtils.clamp(
          activePointer.startPitch + deltaY * 0.004,
          -MAX_VIEW_PITCH,
          MAX_VIEW_PITCH,
        );
        renderManualChange();
        return;
      }

      if (paused || event.pointerType !== "mouse" || event.buttons !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const normalizedX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const normalizedY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      hoverYawTarget = THREE.MathUtils.clamp(normalizedX, -1, 1) * 0.055;
      hoverPitchTarget = THREE.MathUtils.clamp(normalizedY, -1, 1) * 0.035;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!activePointer || activePointer.pointerId !== event.pointerId) return;
      const completedPointer = activePointer;
      activePointer = null;
      releasePointerCapture(completedPointer.pointerId);
      if (completedPointer.dragged || completedPointer.verticalScrollIntent) return;
      const level = pickSignal(event);
      if (level) selectSignal(level, true);
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (!activePointer || activePointer.pointerId !== event.pointerId) return;
      activePointer = null;
      releasePointerCapture(event.pointerId);
    };

    const onLostPointerCapture = (event: PointerEvent) => {
      if (activePointer?.pointerId === event.pointerId) activePointer = null;
    };

    const onPointerLeave = () => {
      if (!activePointer && !paused) clearHover();
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerCancel);
    renderer.domElement.addEventListener("lostpointercapture", onLostPointerCapture);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    removeInteractionListeners = () => {
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      renderer.domElement.removeEventListener("lostpointercapture", onLostPointerCapture);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
    };

    if (typeof ResizeObserver === "undefined") {
      usingWindowResize = true;
      window.addEventListener("resize", resize, { passive: true });
    } else {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
    }

    handleContextLost = (event: Event) => {
      event.preventDefault();
      paused = true;
      stopLoop();
      releaseActivePointer?.();
      clearHover();
      onContextLost?.();
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

    const controller: HomeSceneRendererController = {
      resetView() {
        if (disposed) return;
        viewYawTarget = 0;
        viewPitchTarget = 0;
        clearHover();
        renderManualChange();
      },
      setLayoutMode(mode) {
        // An explicit manual request must also settle a frozen scroll pose,
        // even when the remembered manual layout already has this name.
        if (disposed) return;
        layoutMode = mode;
        renderer.domElement.dataset.layoutMode = mode;
        renderManualChange();
      },
      setPaused(nextPaused) {
        if (disposed || paused === nextPaused) return;
        paused = nextPaused;
        if (paused) {
          stopLoop();
          clearHover();
          renderManualChange();
        } else {
          startLoop();
        }
      },
      setScrollProgress(progress) {
        if (disposed) return;
        if (progress !== null && !Number.isFinite(progress)) return;
        scrollTarget = progress === null
          ? null
          : THREE.MathUtils.clamp(progress, 0, 1);
        scrollControlled = scrollTarget !== null;
        renderer.domElement.dataset.scrollControlled = String(scrollControlled);
        renderer.domElement.dataset.scrollTarget = scrollTarget?.toFixed(3) ?? "";
      },
      setSelectedSignal(level) {
        selectSignal(level, false);
      },
      dispose: cleanup,
    };

    resize();
    if (!paused) startLoop();
    return controller;
  } catch (error) {
    cleanup();
    throw error;
  }
}
