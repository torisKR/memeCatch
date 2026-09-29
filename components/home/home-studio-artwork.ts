import * as THREE from "three";

import {
  HOME_SCENE_LAYOUT_POSES,
  type HomeSceneLayoutObjectName,
  type HomeSceneObjectPose,
} from "@/lib/home-scene-layout";
import type { SafetyLevel } from "@/lib/labels";

type SignalKind = "check" | "context" | "clock" | "stop";

const ORANGE = 0xff5a2f;
const IVORY = 0xf2eee5;
const PAPER = 0xfffcf6;
const INK = 0x26282a;
const CHROME = 0xc7ccd0;

const SIGNAL_LEVEL_BY_KIND: Record<SignalKind, SafetyLevel> = {
  check: "green",
  context: "yellow",
  clock: "gray",
  stop: "red",
};

const SIGNAL_COLOR: Record<SafetyLevel, number> = {
  green: 0x3f8c63,
  yellow: 0xe39b35,
  gray: 0x75818e,
  red: 0xc43a20,
};

export class HomeStudioResourceTracker {
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();

  geometry<T extends THREE.BufferGeometry>(geometry: T) {
    this.geometries.add(geometry);
    return geometry;
  }

  material<T extends THREE.Material>(material: T) {
    this.materials.add(material);
    return material;
  }

  dispose() {
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.geometries.clear();
    this.materials.clear();
  }
}

function traceRoundedRectangle(
  path: THREE.Shape | THREE.Path,
  width: number,
  height: number,
  radius: number,
  clockwise = false,
) {
  const left = -width / 2;
  const right = width / 2;
  const bottom = -height / 2;
  const top = height / 2;

  if (clockwise) {
    path.moveTo(left + radius, bottom);
    path.quadraticCurveTo(left, bottom, left, bottom + radius);
    path.lineTo(left, top - radius);
    path.quadraticCurveTo(left, top, left + radius, top);
    path.lineTo(right - radius, top);
    path.quadraticCurveTo(right, top, right, top - radius);
    path.lineTo(right, bottom + radius);
    path.quadraticCurveTo(right, bottom, right - radius, bottom);
    path.lineTo(left + radius, bottom);
    return;
  }

  path.moveTo(left + radius, bottom);
  path.lineTo(right - radius, bottom);
  path.quadraticCurveTo(right, bottom, right, bottom + radius);
  path.lineTo(right, top - radius);
  path.quadraticCurveTo(right, top, right - radius, top);
  path.lineTo(left + radius, top);
  path.quadraticCurveTo(left, top, left, top - radius);
  path.lineTo(left, bottom + radius);
  path.quadraticCurveTo(left, bottom, left + radius, bottom);
}

function makeRoundedRectangleShape(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  traceRoundedRectangle(shape, width, height, radius);
  return shape;
}

function makeSpeechLoopShape() {
  const width = 4.2;
  const height = 3.12;
  const radius = 0.62;
  const left = -width / 2;
  const right = width / 2;
  const bottom = -height / 2;
  const top = height / 2;
  const shape = new THREE.Shape();

  shape.moveTo(left + radius, bottom);
  shape.lineTo(0.38, bottom);
  shape.quadraticCurveTo(0.7, bottom - 0.03, 0.78, bottom - 0.3);
  shape.lineTo(1.28, bottom - 0.96);
  shape.quadraticCurveTo(1.39, bottom - 1.08, 1.55, bottom - 0.91);
  shape.quadraticCurveTo(1.19, bottom - 0.28, 1.7, bottom);
  shape.lineTo(right - radius, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + radius);
  shape.lineTo(right, top - radius);
  shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(left + radius, top);
  shape.quadraticCurveTo(left, top, left, top - radius);
  shape.lineTo(left, bottom + radius);
  shape.quadraticCurveTo(left, bottom, left + radius, bottom);

  const opening = new THREE.Path();
  traceRoundedRectangle(opening, 2.8, 1.9, 0.46, true);
  shape.holes.push(opening);
  return shape;
}

function extrude(
  shape: THREE.Shape,
  resources: HomeStudioResourceTracker,
  {
    bevelSize,
    bevelThickness,
    depth,
  }: { bevelSize: number; bevelThickness: number; depth: number },
) {
  const geometry = resources.geometry(new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 6,
    bevelSize,
    bevelThickness,
    curveSegments: 18,
    depth,
    steps: 1,
  }));
  geometry.center();
  return geometry;
}

function createStroke(
  points: Array<[number, number]>,
  material: THREE.Material,
  resources: HomeStudioResourceTracker,
  closed = false,
  radius = 0.018,
) {
  const vectors = points.map(([x, y]) => new THREE.Vector3(x, y, 0));
  if (closed && vectors.length > 1) vectors.push(vectors[0].clone());

  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let index = 1; index < vectors.length; index += 1) {
    path.add(new THREE.LineCurve3(vectors[index - 1], vectors[index]));
  }

  return new THREE.Mesh(
    resources.geometry(
      new THREE.TubeGeometry(path, Math.max(vectors.length * 7, 14), radius, 7, false),
    ),
    material,
  );
}

function createSignalGlyph(kind: SignalKind, resources: HomeStudioResourceTracker) {
  const glyph = new THREE.Group();
  const lineMaterial = resources.material(new THREE.MeshStandardMaterial({
    color: PAPER,
    metalness: 0.04,
    roughness: 0.42,
  }));

  if (kind === "check") {
    glyph.add(createStroke(
      [[-0.18, 0], [-0.04, -0.14], [0.22, 0.18]],
      lineMaterial,
      resources,
      false,
      0.026,
    ));
  }

  if (kind === "context") {
    glyph.add(createStroke([
      [-0.22, 0.15], [0.12, 0.15], [0.22, 0.05], [0.22, -0.12],
      [0.1, -0.21], [-0.06, -0.21], [-0.2, -0.29], [-0.16, -0.2],
      [-0.22, -0.12], [-0.22, 0.15],
    ], lineMaterial, resources));
    glyph.add(createStroke([[0, 0.07], [0, -0.08]], lineMaterial, resources));
    const dot = new THREE.Mesh(
      resources.geometry(new THREE.SphereGeometry(0.025, 10, 8)),
      lineMaterial,
    );
    dot.position.set(0, -0.16, 0);
    glyph.add(dot);
  }

  if (kind === "clock") {
    const circle = new THREE.EllipseCurve(0, 0, 0.22, 0.22, 0, Math.PI * 2)
      .getPoints(32)
      .map(({ x, y }) => [x, y] as [number, number]);
    glyph.add(createStroke(circle, lineMaterial, resources, true));
    glyph.add(createStroke([[0, 0.11], [0, -0.02], [0.12, -0.1]], lineMaterial, resources));
  }

  if (kind === "stop") {
    const octagon = Array.from({ length: 8 }, (_, index) => {
      const angle = Math.PI / 8 + index * Math.PI / 4;
      return [Math.cos(angle) * 0.23, Math.sin(angle) * 0.23] as [number, number];
    });
    glyph.add(createStroke(octagon, lineMaterial, resources, true));
    glyph.add(createStroke([[-0.15, 0], [0.15, 0]], lineMaterial, resources, false, 0.025));
  }

  glyph.name = `signal-glyph-${kind}`;
  return glyph;
}

function createSignalToken(
  kind: SignalKind,
  resources: HomeStudioResourceTracker,
) {
  const level = SIGNAL_LEVEL_BY_KIND[kind];
  const color = SIGNAL_COLOR[level];
  const token = new THREE.Group();
  token.name = `signal-token-${kind}`;
  token.userData.signalLevel = level;

  const shell = new THREE.Mesh(
    resources.geometry(new THREE.CylinderGeometry(0.38, 0.38, 0.16, 40, 1, false)),
    resources.material(new THREE.MeshPhysicalMaterial({
      clearcoat: 0.5,
      clearcoatRoughness: 0.2,
      color: CHROME,
      envMapIntensity: 1.35,
      metalness: 0.88,
      roughness: 0.2,
    })),
  );
  shell.rotation.x = Math.PI / 2;
  token.add(shell);

  const face = new THREE.Mesh(
    resources.geometry(new THREE.CircleGeometry(0.292, 40)),
    resources.material(new THREE.MeshPhysicalMaterial({
      clearcoat: 0.15,
      clearcoatRoughness: 0.4,
      color,
      emissive: color,
      emissiveIntensity: 0.015,
      envMapIntensity: 0.3,
      metalness: 0,
      roughness: 0.58,
    })),
  );
  face.name = `signal-face-${level}`;
  face.position.z = 0.086;
  token.add(face);

  const selectionRing = new THREE.Mesh(
    resources.geometry(new THREE.TorusGeometry(0.335, 0.025, 8, 40)),
    resources.material(new THREE.MeshStandardMaterial({
      color: PAPER,
      emissive: color,
      emissiveIntensity: 0.18,
      metalness: 0.22,
      roughness: 0.3,
    })),
  );
  selectionRing.name = `signal-selection-ring-${level}`;
  selectionRing.position.z = 0.108;
  selectionRing.visible = false;
  token.add(selectionRing);

  const glyph = createSignalGlyph(kind, resources);
  glyph.position.z = 0.112;
  token.add(glyph);
  token.userData.face = face;
  token.userData.selectionRing = selectionRing;
  return token;
}

function createCardMarks(
  resources: HomeStudioResourceTracker,
  accent: number,
) {
  const marks = new THREE.Group();
  const material = resources.material(new THREE.MeshStandardMaterial({
    color: accent,
    metalness: 0.12,
    roughness: 0.5,
  }));

  [1.15, 0.82, 1.02].forEach((width, index) => {
    const mark = new THREE.Mesh(
      resources.geometry(new THREE.CapsuleGeometry(0.025, width, 4, 10)),
      material,
    );
    mark.rotation.z = Math.PI / 2;
    mark.position.set(-0.18 + width * 0.08, 0.38 - index * 0.3, 0.16);
    marks.add(mark);
  });

  const stamp = new THREE.Mesh(
    resources.geometry(new THREE.RingGeometry(0.13, 0.18, 24)),
    material,
  );
  stamp.position.set(0.96, -0.52, 0.16);
  marks.add(stamp);
  return marks;
}

function createEditorialCard(
  side: "left" | "right",
  resources: HomeStudioResourceTracker,
) {
  const group = new THREE.Group();
  group.name = `editorial-card-${side}-assembly`;

  const rim = new THREE.Mesh(
    extrude(makeRoundedRectangleShape(3.08, 2.08, 0.36), resources, {
      bevelSize: 0.08,
      bevelThickness: 0.09,
      depth: 0.2,
    }),
    resources.material(new THREE.MeshPhysicalMaterial({
      clearcoat: 0.35,
      clearcoatRoughness: 0.2,
      color: CHROME,
      envMapIntensity: 1.45,
      metalness: 0.88,
      roughness: 0.2,
    })),
  );
  rim.name = `editorial-card-${side}-rim`;
  group.add(rim);

  const card = new THREE.Mesh(
    extrude(makeRoundedRectangleShape(2.84, 1.84, 0.29), resources, {
      bevelSize: 0.06,
      bevelThickness: 0.065,
      depth: 0.16,
    }),
    resources.material(new THREE.MeshPhysicalMaterial({
      clearcoat: 0.24,
      clearcoatRoughness: 0.4,
      color: IVORY,
      envMapIntensity: 0.95,
      metalness: 0.02,
      roughness: 0.48,
    })),
  );
  card.name = `editorial-card-${side}`;
  card.position.z = 0.13;
  card.add(createCardMarks(resources, side === "left" ? ORANGE : INK));
  group.add(card);
  return group;
}

function applyPose(object: THREE.Object3D, pose: HomeSceneObjectPose) {
  object.position.set(...pose.position);
  object.rotation.set(...pose.rotation);
}

export function createHomeStudioArtwork(resources: HomeStudioResourceTracker) {
  const artwork = new THREE.Group();
  artwork.name = "meme-signal-catcher";

  const heroAssembly = new THREE.Group();
  heroAssembly.name = "speech-loop-still-life";
  heroAssembly.position.y = 0.08;
  heroAssembly.userData.baseY = heroAssembly.position.y;
  artwork.add(heroAssembly);

  const leftCard = createEditorialCard("left", resources);
  applyPose(leftCard, HOME_SCENE_LAYOUT_POSES.stacked[leftCard.name as HomeSceneLayoutObjectName]);
  heroAssembly.add(leftCard);

  const rightCard = createEditorialCard("right", resources);
  applyPose(rightCard, HOME_SCENE_LAYOUT_POSES.stacked[rightCard.name as HomeSceneLayoutObjectName]);
  heroAssembly.add(rightCard);

  const emblem = new THREE.Mesh(
    extrude(makeSpeechLoopShape(), resources, {
      bevelSize: 0.2,
      bevelThickness: 0.2,
      depth: 0.62,
    }),
    resources.material(new THREE.MeshPhysicalMaterial({
      clearcoat: 0.86,
      clearcoatRoughness: 0.13,
      color: ORANGE,
      envMapIntensity: 1.3,
      ior: 1.48,
      metalness: 0.08,
      roughness: 0.28,
      transmission: 0,
    })),
  );
  emblem.name = "speech-loop-emblem";
  applyPose(
    emblem,
    HOME_SCENE_LAYOUT_POSES.stacked[emblem.name as HomeSceneLayoutObjectName],
  );
  heroAssembly.add(emblem);

  const tokenKinds: SignalKind[] = ["check", "context", "clock", "stop"];
  const tokens: THREE.Group[] = [];

  tokenKinds.forEach((kind, index) => {
    const token = createSignalToken(kind, resources);
    applyPose(
      token,
      HOME_SCENE_LAYOUT_POSES.stacked[token.name as HomeSceneLayoutObjectName],
    );
    token.userData.phase = index * 1.37;
    tokens.push(token);
    artwork.add(token);
  });

  const layoutObjects: Record<HomeSceneLayoutObjectName, THREE.Object3D> = {
    "speech-loop-emblem": emblem,
    "editorial-card-left-assembly": leftCard,
    "editorial-card-right-assembly": rightCard,
    "signal-token-check": tokens[0],
    "signal-token-context": tokens[1],
    "signal-token-clock": tokens[2],
    "signal-token-stop": tokens[3],
  };

  return { artwork, heroAssembly, layoutObjects, tokens };
}
