// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pmremMock = vi.hoisted(() => {
  const instances: Array<{
    dispose: ReturnType<typeof vi.fn>;
    fromScene: ReturnType<typeof vi.fn>;
    target: {
      dispose: ReturnType<typeof vi.fn>;
      texture: { name: string };
    };
  }> = [];

  class PMREMGenerator {
    readonly target = {
      dispose: vi.fn(),
      texture: { name: "home-studio-environment" },
    };
    readonly fromScene = vi.fn(() => this.target);
    readonly dispose = vi.fn();

    constructor() {
      instances.push(this);
    }
  }

  return { instances, PMREMGenerator };
});

const rendererMock = vi.hoisted(() => {
  const instances: Array<{
    dispose: ReturnType<typeof vi.fn>;
    domElement: HTMLCanvasElement;
    forceContextLoss: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    setPixelRatio: ReturnType<typeof vi.fn>;
    setSize: ReturnType<typeof vi.fn>;
  }> = [];
  let throwOnRender = false;

  class WebGLRenderer {
    readonly domElement = document.createElement("canvas");
    readonly dispose = vi.fn();
    readonly forceContextLoss = vi.fn();
    readonly render = vi.fn(() => {
      if (throwOnRender) throw new Error("initial render failed");
    });
    readonly setPixelRatio = vi.fn();
    readonly setSize = vi.fn();
    outputColorSpace = "";
    toneMapping = 0;
    toneMappingExposure = 1;

    constructor() {
      instances.push(this);
    }
  }

  return {
    WebGLRenderer,
    instances,
    setThrowOnRender(value: boolean) {
      throwOnRender = value;
    },
  };
});

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    PMREMGenerator: pmremMock.PMREMGenerator,
    WebGLRenderer: rendererMock.WebGLRenderer,
  };
});

import * as THREE from "three";

import { mountHomeScene } from "@/components/home/home-scene-renderer";
import { HOME_SCENE_LAYOUT_POSES } from "@/lib/home-scene-layout";
import type { SafetyLevel } from "@/lib/labels";

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  readonly disconnect = vi.fn();
  readonly observe = vi.fn();

  constructor(readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }
}

function setHostSize(host: HTMLElement, width: number, height: number) {
  Object.defineProperties(host, {
    clientHeight: { configurable: true, value: height },
    clientWidth: { configurable: true, value: width },
  });
}

function mountSizedScene(
  width = 1120,
  height = 390,
  options: Parameters<typeof mountHomeScene>[1] = {},
) {
  const host = document.createElement("div");
  setHostSize(host, width, height);
  document.body.append(host);
  const controller = mountHomeScene(host, options);
  const renderer = rendererMock.instances.at(-1);
  const [scene, camera] = renderer?.render.mock.calls.at(-1) ?? [];
  const canvas = renderer?.domElement;

  if (canvas) {
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: height,
        height,
        left: 0,
        right: width,
        top: 0,
        width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
  }

  return {
    camera: camera as THREE.PerspectiveCamera,
    canvas,
    controller,
    host,
    renderer,
    scene: scene as THREE.Scene,
  };
}

function installPointerCapture(canvas: HTMLCanvasElement) {
  const captured = new Set<number>();
  const setPointerCapture = vi.fn((pointerId: number) => captured.add(pointerId));
  const releasePointerCapture = vi.fn((pointerId: number) => captured.delete(pointerId));
  const hasPointerCapture = vi.fn((pointerId: number) => captured.has(pointerId));

  Object.assign(canvas, {
    hasPointerCapture,
    releasePointerCapture,
    setPointerCapture,
  });

  return { captured, hasPointerCapture, releasePointerCapture, setPointerCapture };
}

function dispatchPointer(
  target: HTMLCanvasElement,
  type: string,
  {
    button = 0,
    buttons = type === "pointerup" ? 0 : 1,
    clientX = 0,
    clientY = 0,
    isPrimary = true,
    pointerId = 1,
    pointerType = "mouse",
  }: Partial<Pick<
    PointerEvent,
    "button" | "buttons" | "clientX" | "clientY" | "isPrimary" | "pointerId" | "pointerType"
  >> = {},
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: button },
    buttons: { value: buttons },
    clientX: { value: clientX },
    clientY: { value: clientY },
    isPrimary: { value: isPrimary },
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
  });
  target.dispatchEvent(event);
  return event;
}

function screenPointFor(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
) {
  object.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  const projected = object.getWorldPosition(new THREE.Vector3()).project(camera);
  return {
    clientX: (projected.x + 1) * width / 2,
    clientY: (1 - projected.y) * height / 2,
  };
}

function intersectionNamesAt(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  clientX: number,
  clientY: number,
  width: number,
  height: number,
) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(
    new THREE.Vector2(clientX / width * 2 - 1, -(clientY / height) * 2 + 1),
    camera,
  );
  return raycaster.intersectObjects(scene.children, true).map(({ object }) => object.name);
}

function getMesh(scene: THREE.Scene, name: string) {
  const object = scene.getObjectByName(name);
  expect(object, `missing scene object: ${name}`).toBeInstanceOf(THREE.Mesh);
  return object as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
}

function getSignalToken(scene: THREE.Scene, level: SafetyLevel) {
  let match: THREE.Object3D | undefined;
  scene.traverse((object) => {
    if (object.userData.signalLevel === level) match = object;
  });
  return match;
}

function projectedBounds(object: THREE.Object3D, camera: THREE.PerspectiveCamera) {
  object.updateWorldMatrix(true, true);
  camera.updateProjectionMatrix();
  camera.updateWorldMatrix(true, false);

  const box = new THREE.Box3().setFromObject(object);
  const corners = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ].map((corner) => corner.project(camera));

  return {
    box,
    maxX: Math.max(...corners.map(({ x }) => x)),
    maxY: Math.max(...corners.map(({ y }) => y)),
    maxZ: Math.max(...corners.map(({ z }) => z)),
    minX: Math.min(...corners.map(({ x }) => x)),
    minY: Math.min(...corners.map(({ y }) => y)),
    minZ: Math.min(...corners.map(({ z }) => z)),
  };
}

function installControlledAnimationFrames() {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  const cancel = vi.fn((id: number) => callbacks.delete(id));

  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);

  return {
    advanceTo(time: number) {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(time));
    },
    cancel,
    pendingCount() {
      return callbacks.size;
    },
    request,
  };
}

describe("mountHomeScene artwork", () => {
  beforeEach(() => {
    rendererMock.instances.length = 0;
    rendererMock.setThrowOnRender(false);
    pmremMock.instances.length = 0;
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 101));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 3,
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds one oversized hollow orange speech-loop emblem with a substantial enamel profile", () => {
    const { controller, scene } = mountSizedScene();
    const artwork = scene.getObjectByName("meme-signal-catcher");
    const emblem = getMesh(scene, "speech-loop-emblem");

    expect(artwork).toBeInstanceOf(THREE.Group);
    expect(emblem.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect((emblem.geometry as THREE.ExtrudeGeometry).parameters.shapes).toMatchObject({
      holes: { length: 1 },
    });
    emblem.geometry.computeBoundingBox();
    expect(emblem.geometry.boundingBox?.getSize(new THREE.Vector3()).z).toBeGreaterThan(0.65);

    const material = emblem.material as THREE.MeshPhysicalMaterial;
    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(material.color.getHex()).toBe(0xff5a2f);
    expect(material.clearcoat).toBeGreaterThanOrEqual(0.7);
    expect(material.roughness).toBeGreaterThanOrEqual(0.2);
    expect(material.roughness).toBeLessThanOrEqual(0.36);
    expect(material.transmission).toBe(0);
    expect(Math.abs(emblem.rotation.y)).toBeGreaterThan(0.4);

    emblem.updateWorldMatrix(true, false);
    const openingRay = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 4).applyMatrix4(emblem.matrixWorld),
      new THREE.Vector3(0, 0, -1).transformDirection(emblem.matrixWorld),
    );
    expect(openingRay.intersectObject(emblem, false)).toHaveLength(0);

    for (const obsoleteName of [
      "orange-meme-mascot",
      "mascot-eye-left",
      "mascot-eye-right",
      "mascot-smile",
      "mascot-foot-left",
      "mascot-foot-right",
      "signal-display-plinth",
      "asymmetric-orbit-frame",
      "satellite-orbit-rail",
    ]) {
      expect(scene.getObjectByName(obsoleteName)).toBeUndefined();
    }
    controller.dispose();
  });

  it("layers two staggered chrome and ivory editorial cards behind four clean signal tokens", () => {
    const { controller, scene } = mountSizedScene();
    const emblem = scene.getObjectByName("speech-loop-emblem");

    for (const side of ["left", "right"]) {
      const cardName = `editorial-card-${side}`;
      const card = getMesh(scene, cardName);
      const rim = getMesh(scene, `${cardName}-rim`);
      expect(card.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
      expect((card.material as THREE.MeshPhysicalMaterial).color.getHex()).toBe(0xf2eee5);
      expect((rim.material as THREE.MeshPhysicalMaterial).metalness).toBeGreaterThan(0.7);
      expect(card.getWorldPosition(new THREE.Vector3()).z).toBeLessThan(
        emblem?.getWorldPosition(new THREE.Vector3()).z ?? 0,
      );
    }

    for (const kind of ["check", "context", "clock", "stop"]) {
      const token = scene.getObjectByName(`signal-token-${kind}`);
      const glyph = scene.getObjectByName(`signal-glyph-${kind}`);
      expect(token).toBeInstanceOf(THREE.Group);
      expect(glyph).toBeInstanceOf(THREE.Group);
      expect(token?.visible).toBe(true);
      expect(glyph?.visible).toBe(true);
    }
    const meshes: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    expect(meshes.length).toBeLessThanOrEqual(48);
    controller.dispose();
  });

  it("uses one bundled studio PMREM and restrained neutral scene lights", () => {
    const { controller, scene } = mountSizedScene();
    const pmrem = pmremMock.instances[0];

    expect(pmremMock.instances).toHaveLength(1);
    expect(pmrem?.fromScene).toHaveBeenCalledTimes(1);
    expect(pmrem?.fromScene.mock.calls[0]?.[0].name).toBe("RoomEnvironment");
    expect(pmrem?.fromScene.mock.calls[0]?.slice(1)).toEqual([
      0.035,
      0.1,
      100,
      { size: 64 },
    ]);
    expect(scene.environment).toBe(pmrem?.target.texture);
    expect(pmrem?.dispose).toHaveBeenCalledTimes(1);

    const lights: THREE.Light[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Light) lights.push(object);
    });
    expect(lights.some((light) => light instanceof THREE.PointLight)).toBe(false);
    expect(lights.length).toBeLessThanOrEqual(3);
    // A low-key product-lighting setup retains saturated signal faces rather than
    // bleaching them into near-white in the actual charcoal-stage screenshot.
    expect(scene.environmentIntensity).toBeLessThanOrEqual(0.5);
    expect(Math.max(...lights.map((light) => light.intensity))).toBeLessThanOrEqual(1.5);

    controller.dispose();
    expect(pmrem?.target.dispose).toHaveBeenCalledTimes(1);
  });

  it("maps visible tokens to safety levels and emphasizes the initial selection", () => {
    const { canvas, controller, scene } = mountSizedScene(1120, 390, {
      selectedSignal: "yellow",
    });

    expect(canvas?.dataset.selectedSignal).toBe("yellow");
    const yellowFace = getMesh(scene, "signal-face-yellow").material as THREE.MeshPhysicalMaterial;
    expect(yellowFace.roughness).toBeGreaterThanOrEqual(0.5);
    expect(yellowFace.envMapIntensity).toBeLessThanOrEqual(0.35);
    const levels: SafetyLevel[] = ["green", "yellow", "gray", "red"];
    levels.forEach((level) => {
      const token = getSignalToken(scene, level);
      const ring = scene.getObjectByName(`signal-selection-ring-${level}`);
      expect(token).toBeInstanceOf(THREE.Group);
      expect(token?.userData.signalLevel).toBe(level);
      expect(ring).toBeInstanceOf(THREE.Mesh);
      expect(ring?.visible).toBe(level === "yellow");
      expect(token?.scale.x).toBe(level === "yellow" ? 1.13 : 1);
    });
    expect((getMesh(scene, "speech-loop-emblem").material as THREE.Material & {
      color: THREE.Color;
    }).color.getHex()).toBe(0xff5a2f);
    controller.dispose();
  });

  it("changes actual artwork transforms between stacked and spread while paused", () => {
    const { canvas, controller, renderer, scene } = mountSizedScene(1120, 390, {
      paused: true,
    });
    const emblem = scene.getObjectByName("speech-loop-emblem")!;
    const leftCard = scene.getObjectByName("editorial-card-left-assembly")!;
    const stackedEmblemPosition = emblem.position.clone();
    const stackedCardPosition = leftCard.position.clone();
    const initialRenderCount = renderer?.render.mock.calls.length ?? 0;

    expect(canvas?.dataset.layoutMode).toBe("stacked");
    expect(canvas?.dataset.layoutProgress).toBe("0.000");

    controller.setLayoutMode("spread");

    expect(canvas?.dataset.layoutMode).toBe("spread");
    expect(canvas?.dataset.layoutProgress).toBe("1.000");
    expect(emblem.position.distanceTo(stackedEmblemPosition)).toBeGreaterThan(0.2);
    expect(leftCard.position.distanceTo(stackedCardPosition)).toBeGreaterThan(0.6);
    expect(renderer?.render).toHaveBeenCalledTimes(initialRenderCount + 1);

    controller.setSelectedSignal("red");
    dispatchPointer(canvas!, "pointerdown", { clientX: 400, clientY: 180 });
    dispatchPointer(canvas!, "pointermove", { clientX: 650, clientY: 90 });
    expect(Number(canvas?.dataset.viewYaw)).not.toBe(0);

    controller.resetView();
    expect(canvas?.dataset.layoutMode).toBe("spread");
    expect(canvas?.dataset.layoutProgress).toBe("1.000");
    expect(canvas?.dataset.selectedSignal).toBe("red");
    expect(canvas?.dataset.viewYaw).toBe("0.000");
    expect(renderer?.render).toHaveBeenCalledTimes(initialRenderCount + 4);
    controller.dispose();
  });

  it.each([0, 0.5, 1])(
    "applies initial scroll progress %s to real geometry before the first draw",
    (scrollProgress) => {
      const { canvas, controller, renderer, scene } = mountSizedScene(1120, 390, {
        paused: true,
        scrollProgress,
      });
      const emblem = scene.getObjectByName("speech-loop-emblem")!;
      const stageRoot = scene.getObjectByName("interactive-sculptural-stage")!;
      const stacked = HOME_SCENE_LAYOUT_POSES.stacked["speech-loop-emblem"];
      const spread = HOME_SCENE_LAYOUT_POSES.spread["speech-loop-emblem"];

      expect(renderer?.render).toHaveBeenCalledTimes(1);
      expect(canvas?.dataset.scrollControlled).toBe("true");
      expect(canvas?.dataset.scrollTarget).toBe(scrollProgress.toFixed(3));
      expect(canvas?.dataset.scrollProgress).toBe(scrollProgress.toFixed(3));
      expect(canvas?.dataset.layoutProgress).toBe(scrollProgress.toFixed(3));
      expect(emblem.position.toArray()).toEqual([
        THREE.MathUtils.lerp(stacked.position[0], spread.position[0], scrollProgress),
        THREE.MathUtils.lerp(stacked.position[1], spread.position[1], scrollProgress),
        THREE.MathUtils.lerp(stacked.position[2], spread.position[2], scrollProgress),
      ]);
      expect(Math.abs(stageRoot.rotation.x)).toBeGreaterThan(0);
      expect(Math.abs(stageRoot.rotation.y)).toBeGreaterThanOrEqual(
        scrollProgress === 0.5 ? 0 : 0.05,
      );
      expect(Math.abs(stageRoot.rotation.x)).toBeLessThanOrEqual(0.2);
      expect(Math.abs(stageRoot.rotation.y)).toBeLessThanOrEqual(0.48);
      controller.dispose();
    },
  );

  it.each([0, 0.7])("reapplies Stack after paused scroll ownership ends at %s", (scrollProgress) => {
    const { canvas, controller, renderer, scene } = mountSizedScene(1120, 390, { paused: true, scrollProgress });
    const draws = renderer?.render.mock.calls.length ?? 0;
    controller.setScrollProgress(null);
    expect(renderer?.render).toHaveBeenCalledTimes(draws);
    controller.setLayoutMode("stacked");
    expect(canvas?.dataset.layoutProgress).toBe("0.000");
    expect(canvas?.dataset.viewYaw).toBe("0.000");
    expect(scene.getObjectByName("speech-loop-emblem")?.position.toArray()).toEqual(HOME_SCENE_LAYOUT_POSES.stacked["speech-loop-emblem"].position);
    expect(renderer?.render).toHaveBeenCalledTimes(draws + 1);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("normalizes finite scroll targets and ignores malformed non-finite updates", () => {
    const { canvas, controller } = mountSizedScene(1120, 390, {
      paused: true,
      scrollProgress: Number.NaN,
    });

    expect(canvas?.dataset.scrollControlled).toBe("false");
    expect(canvas?.dataset.scrollTarget).toBe("");
    expect(canvas?.dataset.scrollProgress).toBe("0.000");

    controller.setScrollProgress(-4);
    expect(canvas?.dataset.scrollControlled).toBe("true");
    expect(canvas?.dataset.scrollTarget).toBe("0.000");

    controller.setScrollProgress(8);
    expect(canvas?.dataset.scrollTarget).toBe("1.000");

    controller.setScrollProgress(Number.POSITIVE_INFINITY);
    controller.setScrollProgress(Number.NaN);
    expect(canvas?.dataset.scrollControlled).toBe("true");
    expect(canvas?.dataset.scrollTarget).toBe("1.000");
    controller.dispose();
  });

  it("damps scroll progress forward and backward on the one existing frame loop", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);
    const frames = installControlledAnimationFrames();
    const { canvas, controller, renderer, scene } = mountSizedScene(1120, 390, {
      scrollProgress: 0,
    });
    const emblem = scene.getObjectByName("speech-loop-emblem")!;
    const startPosition = emblem.position.clone();
    const initialRenderCount = renderer?.render.mock.calls.length ?? 0;

    expect(frames.pendingCount()).toBe(1);
    controller.setScrollProgress(1);
    controller.setScrollProgress(0.8);
    controller.setScrollProgress(1);
    expect(frames.pendingCount()).toBe(1);
    expect(frames.request).toHaveBeenCalledTimes(1);
    expect(renderer?.render).toHaveBeenCalledTimes(initialRenderCount);
    expect(canvas?.dataset.scrollTarget).toBe("1.000");
    expect(canvas?.dataset.scrollProgress).toBe("0.000");

    frames.advanceTo(16);
    const forwardProgress = Number(canvas?.dataset.scrollProgress);
    expect(forwardProgress).toBeGreaterThan(0);
    expect(forwardProgress).toBeLessThan(1);
    expect(emblem.position.distanceTo(startPosition)).toBeGreaterThan(0);
    expect(frames.pendingCount()).toBe(1);

    for (let time = 32; time <= 1200; time += 16) frames.advanceTo(time);
    const nearEndProgress = Number(canvas?.dataset.scrollProgress);
    expect(nearEndProgress).toBeGreaterThan(0.999);

    controller.setScrollProgress(0.2);
    expect(frames.pendingCount()).toBe(1);
    frames.advanceTo(1216);
    const reverseProgress = Number(canvas?.dataset.scrollProgress);
    expect(reverseProgress).toBeLessThan(nearEndProgress);
    expect(reverseProgress).toBeGreaterThan(0.2);
    controller.dispose();
    expect(frames.pendingCount()).toBe(0);
  });

  it("freezes scroll control while paused and resumes toward the last target", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);
    const frames = installControlledAnimationFrames();
    const { canvas, controller, renderer, scene } = mountSizedScene(1120, 390, {
      paused: true,
      scrollProgress: 0.25,
    });
    const emblem = scene.getObjectByName("speech-loop-emblem")!;
    const frozenPosition = emblem.position.clone();
    const frozenProgress = canvas?.dataset.scrollProgress;
    const frozenRenderCount = renderer?.render.mock.calls.length ?? 0;

    controller.setScrollProgress(0.75);
    controller.setScrollProgress(1);
    expect(canvas?.dataset.scrollTarget).toBe("1.000");
    expect(canvas?.dataset.scrollProgress).toBe(frozenProgress);
    expect(emblem.position).toEqual(frozenPosition);
    expect(renderer?.render).toHaveBeenCalledTimes(frozenRenderCount);
    expect(frames.pendingCount()).toBe(0);

    controller.setPaused(false);
    expect(frames.pendingCount()).toBe(1);
    frames.advanceTo(16);
    expect(Number(canvas?.dataset.scrollProgress)).toBeGreaterThan(0.25);
    expect(emblem.position.distanceTo(frozenPosition)).toBeGreaterThan(0);

    controller.setPaused(true);
    const pausedProgress = canvas?.dataset.scrollProgress;
    const pausedPosition = emblem.position.clone();
    expect(frames.pendingCount()).toBe(0);
    controller.setScrollProgress(0);
    expect(canvas?.dataset.scrollTarget).toBe("0.000");
    expect(canvas?.dataset.scrollProgress).toBe(pausedProgress);
    expect(emblem.position).toEqual(pausedPosition);
    expect(frames.pendingCount()).toBe(0);

    controller.setScrollProgress(null);
    expect(canvas?.dataset.scrollControlled).toBe("false");
    expect(canvas?.dataset.scrollTarget).toBe("");
    expect(canvas?.dataset.scrollProgress).toBe(pausedProgress);
    controller.setLayoutMode("spread");
    expect(canvas?.dataset.layoutProgress).toBe("1.000");
    expect(canvas?.dataset.scrollProgress).toBe("1.000");
    controller.dispose();
  });

  it("damps layout, hover, and drag on the existing playback frame without event renders", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);
    const frames = installControlledAnimationFrames();
    const { canvas, controller, renderer, scene } = mountSizedScene();
    installPointerCapture(canvas!);
    const emblem = scene.getObjectByName("speech-loop-emblem")!;
    const stackedPosition = emblem.position.clone();
    const initialRenderCount = renderer?.render.mock.calls.length ?? 0;

    controller.setLayoutMode("spread");
    dispatchPointer(canvas!, "pointermove", {
      buttons: 0,
      clientX: 1080,
      clientY: 40,
      pointerType: "mouse",
    });
    dispatchPointer(canvas!, "pointerdown", { clientX: 560, clientY: 195 });
    dispatchPointer(canvas!, "pointermove", { clientX: 820, clientY: 100 });
    dispatchPointer(canvas!, "pointerup", {
      buttons: 0,
      clientX: 820,
      clientY: 100,
    });

    expect(renderer?.render).toHaveBeenCalledTimes(initialRenderCount);
    expect(frames.request).toHaveBeenCalledTimes(1);
    expect(canvas?.dataset.layoutMode).toBe("spread");
    expect(canvas?.dataset.layoutProgress).toBe("0.000");
    expect(emblem.position).toEqual(stackedPosition);

    frames.advanceTo(16);
    const firstProgress = Number(canvas?.dataset.layoutProgress);
    const firstYaw = Number(canvas?.dataset.viewYaw);
    expect(firstProgress).toBeGreaterThan(0);
    expect(firstProgress).toBeLessThan(1);
    expect(firstYaw).toBeGreaterThan(0);
    expect(firstYaw).toBeLessThanOrEqual(0.48);
    expect(renderer?.render).toHaveBeenCalledTimes(initialRenderCount + 1);

    for (let time = 32; time <= 1600; time += 16) frames.advanceTo(time);
    expect(Number(canvas?.dataset.layoutProgress)).toBeGreaterThan(0.999);
    expect(emblem.position.distanceTo(stackedPosition)).toBeGreaterThan(0.2);
    controller.dispose();
  });

  it("updates a playing selection without creating an event render", () => {
    const onSignalSelect = vi.fn();
    const { camera, canvas, controller, renderer, scene } = mountSizedScene(1120, 390, {
      onSignalSelect,
    });
    installPointerCapture(canvas!);
    const redToken = getSignalToken(scene, "red")!;
    const point = screenPointFor(redToken, camera, 1120, 390);
    const renderCount = renderer?.render.mock.calls.length ?? 0;

    dispatchPointer(canvas!, "pointerdown", point);
    dispatchPointer(canvas!, "pointerup", { ...point, buttons: 0 });

    expect(onSignalSelect).toHaveBeenCalledWith("red");
    expect(canvas?.dataset.selectedSignal).toBe("red");
    expect(scene.getObjectByName("signal-selection-ring-red")?.visible).toBe(true);
    expect(renderer?.render).toHaveBeenCalledTimes(renderCount);
    controller.dispose();
  });

  it("converges to the same layout progress across common frame rates", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);

    const sampleProgress = (frameDuration: number) => {
      const frames = installControlledAnimationFrames();
      const { canvas, controller } = mountSizedScene();
      controller.setLayoutMode("spread");
      for (let time = frameDuration; time <= 1000; time += frameDuration) {
        frames.advanceTo(time);
      }
      const progress = Number(canvas?.dataset.layoutProgress);
      controller.dispose();
      return progress;
    };

    const progressAt60Fps = sampleProgress(1000 / 60);
    const progressAt30Fps = sampleProgress(1000 / 30);
    expect(progressAt60Fps).toBeGreaterThan(0.99);
    expect(progressAt30Fps).toBeGreaterThan(0.99);
    expect(progressAt60Fps).toBeCloseTo(progressAt30Fps, 2);
  });

  it.each(["stacked", "spread"] as const)(
    "selects an actual visible token by raycast in the %s layout",
    (layoutMode) => {
    const onSignalSelect = vi.fn();
    const { camera, canvas, controller, scene } = mountSizedScene(1120, 390, {
      layoutMode,
      onSignalSelect,
      paused: true,
    });
    expect(canvas).toBeDefined();
    expect(canvas?.dataset.layoutMode).toBe(layoutMode);
    expect(canvas?.dataset.layoutProgress).toBe(layoutMode === "spread" ? "1.000" : "0.000");
    installPointerCapture(canvas!);
    const levels: SafetyLevel[] = ["green", "yellow", "gray", "red"];
    levels.forEach((level) => {
      const token = getSignalToken(scene, level);
      expect(token).toBeInstanceOf(THREE.Group);
      const point = screenPointFor(token!, camera, 1120, 390);
      const callCount = onSignalSelect.mock.calls.length;
      dispatchPointer(canvas!, "pointerdown", point);
      dispatchPointer(canvas!, "pointerup", { ...point, buttons: 0 });
      expect(
        onSignalSelect,
        `${level} intersections: ${intersectionNamesAt(
          scene,
          camera,
          point.clientX,
          point.clientY,
          1120,
          390,
        ).join(", ")}`,
      ).toHaveBeenCalledTimes(callCount + 1);
    });

    expect(onSignalSelect.mock.calls.map(([level]) => level)).toEqual(levels);
    expect(canvas?.dataset.selectedSignal).toBe("red");
    expect(scene.getObjectByName("signal-selection-ring-red")?.visible).toBe(true);
    expect(rendererMock.instances.at(-1)?.render).toHaveBeenCalledTimes(5);
    controller.dispose();
    },
  );

  it.each([0, 0.5, 1])(
    "selects every visible token by raycast at scroll progress %s",
    (scrollProgress) => {
      const onSignalSelect = vi.fn();
      const { camera, canvas, controller, scene } = mountSizedScene(1120, 390, {
        onSignalSelect,
        paused: true,
        scrollProgress,
      });
      installPointerCapture(canvas!);
      const levels: SafetyLevel[] = ["green", "yellow", "gray", "red"];

      levels.forEach((level) => {
        const token = getSignalToken(scene, level)!;
        const point = screenPointFor(token, camera, 1120, 390);
        const callCount = onSignalSelect.mock.calls.length;
        dispatchPointer(canvas!, "pointerdown", point);
        dispatchPointer(canvas!, "pointerup", { ...point, buttons: 0 });
        expect(
          onSignalSelect,
          `${level} at ${scrollProgress}: ${intersectionNamesAt(
            scene,
            camera,
            point.clientX,
            point.clientY,
            1120,
            390,
          ).join(", ")}`,
        ).toHaveBeenCalledTimes(callCount + 1);
      });

      expect(onSignalSelect.mock.calls.map(([level]) => level)).toEqual(levels);
      controller.dispose();
    },
  );

  it("does not select a token hidden behind visible scene geometry", () => {
    const onSignalSelect = vi.fn();
    const { camera, canvas, controller, scene } = mountSizedScene(1120, 390, {
      onSignalSelect, paused: true,
    });
    installPointerCapture(canvas!);
    const token = getSignalToken(scene, "red")!;
    const point = screenPointFor(token, camera, 1120, 390);
    const geometry = new THREE.BoxGeometry(2, 2, 0.2);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blocker = new THREE.Mesh(geometry, material);
    blocker.position.copy(camera.position).lerp(token.getWorldPosition(new THREE.Vector3()), 0.5);
    scene.add(blocker);
    scene.updateMatrixWorld(true);

    dispatchPointer(canvas!, "pointerdown", point);
    dispatchPointer(canvas!, "pointerup", { ...point, buttons: 0 });
    expect(onSignalSelect).not.toHaveBeenCalled();
    expect(canvas?.dataset.selectedSignal).toBe("green");

    blocker.visible = false;
    dispatchPointer(canvas!, "pointerdown", point);
    dispatchPointer(canvas!, "pointerup", { ...point, buttons: 0 });
    expect(onSignalSelect).toHaveBeenCalledOnce();
    expect(onSignalSelect).toHaveBeenCalledWith("red");
    controller.dispose();
    geometry.dispose();
    material.dispose();
  });

  it("ignores secondary and non-primary pointers", () => {
    const onSignalSelect = vi.fn();
    const { camera, canvas, controller, scene } = mountSizedScene(1120, 390, {
      onSignalSelect,
      paused: true,
    });
    const capture = installPointerCapture(canvas!);
    const redToken = getSignalToken(scene, "red");
    const point = screenPointFor(redToken!, camera, 1120, 390);

    dispatchPointer(canvas!, "pointerdown", { ...point, button: 2 });
    dispatchPointer(canvas!, "pointerup", { ...point, button: 2, buttons: 0 });
    dispatchPointer(canvas!, "pointerdown", { ...point, isPrimary: false, pointerId: 2 });
    dispatchPointer(canvas!, "pointerup", {
      ...point,
      buttons: 0,
      isPrimary: false,
      pointerId: 2,
    });

    expect(capture.setPointerCapture).not.toHaveBeenCalled();
    expect(onSignalSelect).not.toHaveBeenCalled();
    expect(canvas?.dataset.selectedSignal).toBe("green");
    controller.dispose();
  });

  it("drags within camera-safe bounds, suppresses click-after-drag, and resets while paused", () => {
    const onSignalSelect = vi.fn();
    const { camera, canvas, controller, scene } = mountSizedScene(1120, 390, {
      onSignalSelect,
      paused: true,
    });
    const capture = installPointerCapture(canvas!);
    const greenToken = getSignalToken(scene, "green");
    const start = screenPointFor(greenToken!, camera, 1120, 390);

    dispatchPointer(canvas!, "pointerdown", start);
    dispatchPointer(canvas!, "pointermove", {
      clientX: start.clientX + 900,
      clientY: start.clientY - 500,
    });
    dispatchPointer(canvas!, "pointerup", {
      buttons: 0,
      clientX: start.clientX + 900,
      clientY: start.clientY - 500,
    });

    expect(onSignalSelect).not.toHaveBeenCalled();
    expect(Math.abs(Number(canvas?.dataset.viewYaw))).toBeLessThanOrEqual(0.48);
    expect(Math.abs(Number(canvas?.dataset.viewPitch))).toBeLessThanOrEqual(0.2);
    expect(Number(canvas?.dataset.viewYaw)).not.toBe(0);
    expect(capture.setPointerCapture).toHaveBeenCalledWith(1);
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(requestAnimationFrame).not.toHaveBeenCalled();

    controller.resetView();
    expect(canvas?.dataset.viewYaw).toBe("0.000");
    expect(canvas?.dataset.viewPitch).toBe("0.000");
    expect(rendererMock.instances.at(-1)?.render.mock.calls.length).toBeGreaterThan(2);
    controller.dispose();
  });

  it("adds pointer pose to scroll pose and clamps the composed root transform", () => {
    const { canvas, controller, scene } = mountSizedScene(1120, 390, {
      paused: true,
      scrollProgress: 1,
    });
    const stageRoot = scene.getObjectByName("interactive-sculptural-stage")!;
    installPointerCapture(canvas!);
    const scrollYaw = stageRoot.rotation.y;
    const scrollPitch = stageRoot.rotation.x;

    dispatchPointer(canvas!, "pointerdown", { clientX: 400, clientY: 200 });
    dispatchPointer(canvas!, "pointermove", { clientX: 450, clientY: 175 });
    expect(stageRoot.rotation.y).toBeGreaterThan(scrollYaw);
    expect(stageRoot.rotation.x).toBeLessThan(scrollPitch);
    expect(stageRoot.rotation.y).toBeCloseTo(Number(canvas?.dataset.viewYaw), 3);
    expect(stageRoot.rotation.x).toBeCloseTo(Number(canvas?.dataset.viewPitch), 3);

    dispatchPointer(canvas!, "pointermove", { clientX: 2_000, clientY: -1_000 });
    expect(stageRoot.rotation.y).toBeCloseTo(0.48);
    expect(stageRoot.rotation.x).toBeCloseTo(-0.2);

    controller.resetView();
    expect(stageRoot.rotation.y).toBeCloseTo(scrollYaw);
    expect(stageRoot.rotation.x).toBeCloseTo(scrollPitch);
    expect(canvas?.dataset.scrollProgress).toBe("1.000");
    controller.dispose();
  });

  it("keeps touch vertical scrolling available and cleans capture on cancel/lost capture", () => {
    const onSignalSelect = vi.fn();
    const { canvas, controller } = mountSizedScene(340, 220, {
      onSignalSelect,
      paused: true,
    });
    const capture = installPointerCapture(canvas!);

    expect(canvas?.style.touchAction).toBe("pan-y pinch-zoom");
    dispatchPointer(canvas!, "pointerdown", {
      clientX: 120,
      clientY: 60,
      pointerId: 7,
      pointerType: "touch",
    });
    const verticalMove = dispatchPointer(canvas!, "pointermove", {
      clientX: 122,
      clientY: 160,
      pointerId: 7,
      pointerType: "touch",
    });
    dispatchPointer(canvas!, "pointercancel", {
      buttons: 0,
      clientX: 122,
      clientY: 160,
      pointerId: 7,
      pointerType: "touch",
    });

    expect(verticalMove.defaultPrevented).toBe(false);
    expect(canvas?.dataset.viewYaw).toBe("0.000");
    expect(canvas?.dataset.viewPitch).toBe("0.000");
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(capture.captured.size).toBe(0);

    dispatchPointer(canvas!, "pointerdown", {
      clientX: 120,
      clientY: 60,
      pointerId: 9,
      pointerType: "touch",
    });
    dispatchPointer(canvas!, "pointermove", {
      clientX: 122,
      clientY: 160,
      pointerId: 9,
      pointerType: "touch",
    });
    dispatchPointer(canvas!, "pointerup", {
      buttons: 0,
      clientX: 122,
      clientY: 160,
      pointerId: 9,
      pointerType: "touch",
    });
    expect(onSignalSelect).not.toHaveBeenCalled();

    dispatchPointer(canvas!, "pointerdown", { pointerId: 8 });
    dispatchPointer(canvas!, "lostpointercapture", { buttons: 0, pointerId: 8 });
    dispatchPointer(canvas!, "pointermove", { clientX: 300, clientY: 10, pointerId: 8 });
    expect(canvas?.dataset.viewYaw).toBe("0.000");
    controller.dispose();
  });

  it("applies fine-pointer hover only while active and removes all interaction listeners", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);
    const frames = installControlledAnimationFrames();
    const onSignalSelect = vi.fn();
    const { canvas, controller, renderer } = mountSizedScene(1120, 390, { onSignalSelect });
    const capture = installPointerCapture(canvas!);
    const renderCountBeforeHover = renderer?.render.mock.calls.length ?? 0;

    dispatchPointer(canvas!, "pointermove", {
      buttons: 0,
      clientX: 1080,
      clientY: 40,
      pointerType: "mouse",
    });
    expect(renderer?.render).toHaveBeenCalledTimes(renderCountBeforeHover);
    frames.advanceTo(16);
    expect(Number(canvas?.dataset.viewYaw)).toBeGreaterThan(0);

    controller.setPaused(true);
    expect(canvas?.dataset.viewYaw).toBe("0.000");
    dispatchPointer(canvas!, "pointermove", {
      buttons: 0,
      clientX: 1080,
      clientY: 40,
      pointerType: "mouse",
    });
    expect(canvas?.dataset.viewYaw).toBe("0.000");

    controller.setSelectedSignal("gray");
    expect(canvas?.dataset.selectedSignal).toBe("gray");
    const renderCountBeforeDispose = renderer?.render.mock.calls.length;
    dispatchPointer(canvas!, "pointerdown", { clientX: 20, clientY: 20, pointerId: 4 });
    controller.dispose();
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(4);
    dispatchPointer(canvas!, "pointerup", {
      buttons: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 4,
    });
    expect(onSignalSelect).not.toHaveBeenCalled();
    expect(renderer?.render).toHaveBeenCalledTimes(renderCountBeforeDispose ?? 0);
  });

  it.each([
    ["wide stacked", 1120, 390, "stacked"],
    ["wide spread", 1120, 390, "spread"],
    ["narrow stacked", 340, 220, "stacked"],
    ["narrow spread", 340, 220, "spread"],
  ] as const)("fits the complete sculpture prominently in the %s banner without clipping", (_label, width, height, layoutMode) => {
    const { camera, canvas, controller, scene } = mountSizedScene(width, height, {
      layoutMode,
      paused: true,
      selectedSignal: "red",
    });
    installPointerCapture(canvas!);
    dispatchPointer(canvas!, "pointerdown", { clientX: width / 2, clientY: height / 2 });
    dispatchPointer(canvas!, "pointermove", { clientX: width * 2, clientY: -height });
    const artwork = scene.getObjectByName("meme-signal-catcher");
    expect(artwork).toBeDefined();

    const bounds = projectedBounds(artwork!, camera);
    expect(bounds.minX).toBeGreaterThan(-0.94);
    expect(bounds.maxX).toBeLessThan(0.94);
    expect(bounds.minY).toBeGreaterThan(-0.94);
    expect(bounds.maxY).toBeLessThan(0.94);
    expect(bounds.minZ).toBeGreaterThan(-1);
    expect(bounds.maxZ).toBeLessThan(1);
    // NDC spans -1..1: 1.5 means at least 75% of the limiting screen
    // dimension, keeping the still life visually dominant without clipping.
    expect(Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)).toBeGreaterThan(1.15);
    controller.dispose();
  });

  it.each([
    ["wide start", 1120, 390, 0],
    ["wide middle", 1120, 390, 0.5],
    ["wide end", 1120, 390, 1],
    ["narrow start", 340, 220, 0],
    ["narrow middle", 340, 220, 0.5],
    ["narrow end", 340, 220, 1],
  ] as const)(
    "keeps the scroll-controlled sculpture inside the camera envelope at %s",
    (_label, width, height, scrollProgress) => {
      const { camera, canvas, controller, scene } = mountSizedScene(width, height, {
        paused: true,
        scrollProgress,
      });
      const artwork = scene.getObjectByName("meme-signal-catcher")!;
      const stageRoot = scene.getObjectByName("interactive-sculptural-stage")!;
      const bounds = projectedBounds(artwork, camera);

      expect(stageRoot.rotation.x).toBeCloseTo(Number(canvas?.dataset.viewPitch), 3);
      expect(stageRoot.rotation.y).toBeCloseTo(Number(canvas?.dataset.viewYaw), 3);
      expect(Math.abs(stageRoot.rotation.x)).toBeLessThanOrEqual(0.2);
      expect(Math.abs(stageRoot.rotation.y)).toBeLessThanOrEqual(0.48);
      expect(bounds.minX).toBeGreaterThan(-0.94);
      expect(bounds.maxX).toBeLessThan(0.94);
      expect(bounds.minY).toBeGreaterThan(-0.94);
      expect(bounds.maxY).toBeLessThan(0.94);
      expect(bounds.minZ).toBeGreaterThan(-1);
      expect(bounds.maxZ).toBeLessThan(1);
      controller.dispose();
    },
  );

  it("caps DPR, pauses and resumes the loop, handles context loss, and fully disposes", () => {
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const materialDispose = vi.spyOn(THREE.Material.prototype, "dispose");
    const onContextLost = vi.fn();
    const host = document.createElement("div");
    setHostSize(host, 1120, 390);
    document.body.append(host);

    const controller = mountHomeScene(host, { maxPixelRatio: 2, onContextLost });
    const renderer = rendererMock.instances[0];
    expect(renderer?.setPixelRatio).toHaveBeenLastCalledWith(1.5);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    controller.setPaused(true);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(101);
    controller.setPaused(false);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);

    const contextLost = new Event("webglcontextlost", { cancelable: true });
    renderer?.domElement.dispatchEvent(contextLost);
    expect(contextLost.defaultPrevented).toBe(true);
    expect(onContextLost).toHaveBeenCalledTimes(1);

    controller.dispose();
    const renderCountAfterDispose = renderer?.render.mock.calls.length ?? 0;
    const requestCountAfterDispose = vi.mocked(requestAnimationFrame).mock.calls.length;
    controller.setScrollProgress(0.75);
    controller.setScrollProgress(null);
    controller.setPaused(false);
    expect(renderer?.render).toHaveBeenCalledTimes(renderCountAfterDispose);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(requestCountAfterDispose);
    expect(renderer?.dispose).toHaveBeenCalledTimes(1);
    expect(renderer?.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(renderer?.domElement.isConnected).toBe(false);
    expect(host.childElementCount).toBe(0);
    expect(MockResizeObserver.instances[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(geometryDispose.mock.calls.length).toBeGreaterThan(0);
    expect(materialDispose.mock.calls.length).toBeGreaterThan(0);
    expect(pmremMock.instances[0]?.target.dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes every initialized resource when the initial render throws", () => {
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const materialDispose = vi.spyOn(THREE.Material.prototype, "dispose");
    const host = document.createElement("div");
    setHostSize(host, 1120, 390);
    document.body.append(host);
    rendererMock.setThrowOnRender(true);

    expect(() => mountHomeScene(host)).toThrow("initial render failed");

    const renderer = rendererMock.instances[0];
    expect(renderer?.dispose).toHaveBeenCalledTimes(1);
    expect(renderer?.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(renderer?.domElement.isConnected).toBe(false);
    expect(host.childElementCount).toBe(0);
    expect(MockResizeObserver.instances[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(geometryDispose.mock.calls.length).toBeGreaterThan(0);
    expect(materialDispose.mock.calls.length).toBeGreaterThan(0);
    expect(pmremMock.instances[0]?.target.dispose).toHaveBeenCalledTimes(1);
  });
});
