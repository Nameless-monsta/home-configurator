/**
 * Procedural hero models + state-driven visual bindings, one per display
 * category. Objects are plain THREE.Group trees so they can be mounted either
 * in a lightweight carousel preview renderer or on the main GraphicsEngine
 * stage, and driven by the living-object registry. docs/PHASE-5-IYO-EXPERIENCE §5.5.
 */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  type MeshPhysicalMaterialParameters,
  MeshStandardMaterial,
  type Object3D,
  PointLight,
  SphereGeometry,
  TorusGeometry,
} from 'three';

import type { DeviceCategory, DeviceViewState } from './experience-model.js';

export interface HeroHandle {
  readonly object: Group;
  apply(state: DeviceViewState): void;
  tick(deltaMs: number, state: DeviceViewState): void;
  dispose(): void;
}

const shell = (
  colour: number,
  options: MeshPhysicalMaterialParameters = {},
): MeshPhysicalMaterial =>
  new MeshPhysicalMaterial({
    color: colour,
    roughness: 0.34,
    metalness: 0.18,
    clearcoat: 0.28,
    clearcoatRoughness: 0.26,
    ...options,
  });

const matte = (colour: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color: colour, roughness: 0.7 });

export const hsbToColor = (hue: number, saturation: number, brightness: number): Color =>
  new Color().setHSL(
    (((hue % 360) + 360) % 360) / 360,
    Math.min(1, Math.max(0, saturation / 100)),
    0.3 + brightness * 0.4,
  );

const disposeGroup = (group: Group): void => {
  group.traverse((node: Object3D) => {
    const mesh = node as Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else if (material) material.dispose();
  });
};

const lightHero = (): HeroHandle => {
  const object = new Group();
  const emitMaterial = new MeshPhysicalMaterial({
    color: 0xf5e9d6,
    emissive: 0xffc987,
    emissiveIntensity: 0,
    roughness: 0.12,
    transmission: 0.25,
  });
  const glow = new PointLight(0xffd6a4, 0, 7, 2);
  const base = new Mesh(new CylinderGeometry(0.62, 0.7, 0.16, 64), shell(0x8f887f));
  const stem = new Mesh(new CylinderGeometry(0.06, 0.06, 1.5, 32), shell(0x8f887f));
  const shade = new Mesh(
    new CylinderGeometry(0.6, 0.32, 0.72, 64, 1, true),
    new MeshPhysicalMaterial({
      color: 0xd7d0c6,
      roughness: 0.2,
      transmission: 0.12,
      transparent: true,
      opacity: 0.94,
      side: DoubleSide,
    }),
  );
  const bulb = new Mesh(new SphereGeometry(0.2, 48, 32), emitMaterial);
  base.position.y = -0.85;
  stem.position.y = -0.05;
  shade.position.y = 0.85;
  bulb.position.y = 0.72;
  glow.position.y = 0.74;
  object.add(base, stem, shade, bulb, glow);

  return {
    object,
    apply(state) {
      const colour = hsbToColor(state.hue, state.saturation, state.brightness);
      emitMaterial.emissive.copy(colour);
      emitMaterial.emissiveIntensity = state.on ? 0.4 + state.brightness * 2.1 : 0;
      glow.color.copy(colour);
      glow.intensity = state.on ? state.brightness * 9 : 0;
    },
    tick() {},
    dispose() {
      disposeGroup(object);
    },
  };
};

const climateHero = (): HeroHandle => {
  const object = new Group();
  const ring = new Mesh(
    new TorusGeometry(0.86, 0.13, 32, 128),
    shell(0x8f887f, { metalness: 0.55, roughness: 0.24 }),
  );
  const faceMaterial = new MeshPhysicalMaterial({
    color: 0x161514,
    roughness: 0.18,
    emissive: 0x8fb4c9,
    emissiveIntensity: 0.14,
  });
  const face = new Mesh(new CylinderGeometry(0.74, 0.74, 0.1, 96), faceMaterial);
  face.rotation.x = Math.PI / 2;
  const needle = new Mesh(new BoxGeometry(0.03, 0.28, 0.02), shell(0xf2efe9));
  needle.position.set(0, 0.5, 0.09);
  const pivot = new Group();
  pivot.add(needle);
  object.add(ring, face, pivot);
  let targetAngle = 0;

  return {
    object,
    apply(state) {
      const t = Math.min(1, Math.max(0, (state.targetTemp - 16) / 14));
      targetAngle = (t - 0.5) * ((Math.PI * 4) / 3);
      const cool = new Color(0x8fb4c9);
      const warm = new Color(0xd8b48a);
      faceMaterial.emissive.copy(cool.lerp(warm, t));
      faceMaterial.emissiveIntensity = state.hvac === 'off' ? 0.06 : 0.3;
    },
    tick(deltaMs) {
      pivot.rotation.z += (-targetAngle - pivot.rotation.z) * Math.min(1, deltaMs / 260);
    },
    dispose() {
      disposeGroup(object);
    },
  };
};

const coverHero = (): HeroHandle => {
  const object = new Group();
  const rail = new Mesh(new BoxGeometry(2.6, 0.1, 0.14), shell(0x39362f));
  rail.position.y = 1.05;
  object.add(rail);
  const panels: Mesh[] = [];
  for (const side of [-1, 1]) {
    const panel = new Mesh(new BoxGeometry(1.24, 2, 0.06), matte(0x4a463f));
    panel.position.set(side * 0.63, 0, 0);
    panels.push(panel);
    object.add(panel);
  }

  return {
    object,
    apply(state) {
      const openness = Math.min(1, Math.max(0, state.position / 100));
      const spread = 0.63 + openness * 0.72;
      const scale = Math.max(0.14, 1 - openness * 0.82);
      panels.forEach((panel, index) => {
        const side = index === 0 ? -1 : 1;
        panel.position.x = side * spread;
        panel.scale.x = scale;
      });
    },
    tick() {},
    dispose() {
      disposeGroup(object);
    },
  };
};

const mediaHero = (): HeroHandle => {
  const object = new Group();
  const panel = new Mesh(new BoxGeometry(2.6, 1.5, 0.06), shell(0x151412));
  const screenMaterial = new MeshPhysicalMaterial({
    color: 0x101010,
    emissive: 0x8fb4c9,
    emissiveIntensity: 0,
    roughness: 0.1,
  });
  const face = new Mesh(new BoxGeometry(2.44, 1.36, 0.012), screenMaterial);
  face.position.z = 0.036;
  const stand = new Mesh(new BoxGeometry(0.7, 0.08, 0.34), shell(0x39362f));
  stand.position.y = -0.86;
  object.add(panel, face, stand);
  let phase = 0;

  return {
    object,
    apply(state) {
      screenMaterial.emissiveIntensity = state.playing ? 0.7 : 0.05;
    },
    tick(deltaMs, state) {
      if (state.playing) {
        phase += deltaMs / 900;
        screenMaterial.emissiveIntensity = 0.55 + Math.sin(phase) * 0.12;
      }
    },
    dispose() {
      disposeGroup(object);
    },
  };
};

const securityHero = (isLock: boolean): HeroHandle => {
  const object = new Group();
  if (isLock) {
    const body = new Mesh(new CylinderGeometry(0.55, 0.55, 0.34, 64), shell(0x6f6a62));
    body.rotation.x = Math.PI / 2;
    const collar = new Mesh(new TorusGeometry(0.55, 0.05, 24, 96), shell(0x8f887f));
    const bolt = new Mesh(new BoxGeometry(0.16, 0.16, 0.7), shell(0xb8b0a4, { metalness: 0.6 }));
    bolt.position.set(0.72, 0, 0);
    const lamp = new PointLight(0x9db08a, 2, 4, 2);
    lamp.position.z = 0.8;
    object.add(body, collar, bolt, lamp);
    let angle = 0;
    return {
      object,
      apply(state) {
        angle = state.locked ? 0 : Math.PI / 2;
        bolt.position.x = state.locked ? 0.72 : 0.4;
        lamp.color.set(state.locked ? 0x9db08a : 0xd8b48a);
      },
      tick(deltaMs) {
        collar.rotation.z += (angle - collar.rotation.z) * Math.min(1, deltaMs / 180);
      },
      dispose() {
        disposeGroup(object);
      },
    };
  }
  const body = new Mesh(new CylinderGeometry(0.34, 0.34, 0.8, 64), shell(0xd7d0c6));
  body.rotation.x = Math.PI / 2;
  const lensMaterial = new MeshPhysicalMaterial({
    color: 0x101010,
    roughness: 0.05,
    emissive: 0xc9776b,
    emissiveIntensity: 0,
  });
  const lens = new Mesh(new SphereGeometry(0.22, 48, 32), lensMaterial);
  lens.position.z = 0.42;
  const shutter = new Mesh(new CylinderGeometry(0.3, 0.3, 0.04, 48), shell(0x39362f));
  shutter.rotation.x = Math.PI / 2;
  shutter.position.z = 0.46;
  object.add(body, lens, shutter);
  return {
    object,
    apply(state) {
      lensMaterial.emissiveIntensity = state.recording && !state.privacy ? 0.7 : 0;
      shutter.visible = state.privacy;
    },
    tick() {},
    dispose() {
      disposeGroup(object);
    },
  };
};

const cleaningHero = (): HeroHandle => {
  const object = new Group();
  const disc = new Mesh(new CylinderGeometry(0.78, 0.82, 0.22, 96), shell(0x2c2a27));
  const ledMaterial = shell(0x9db08a, { emissive: 0x9db08a, emissiveIntensity: 0.4 });
  const led = new Mesh(new TorusGeometry(0.3, 0.02, 16, 64), ledMaterial);
  led.rotation.x = Math.PI / 2;
  led.position.y = 0.12;
  const lidar = new Mesh(new CylinderGeometry(0.14, 0.14, 0.12, 32), shell(0x39362f));
  lidar.position.y = 0.18;
  object.add(disc, led, lidar);

  return {
    object,
    apply(state) {
      ledMaterial.emissive.set(state.cleaning ? 0xd8b48a : 0x9db08a);
    },
    tick(deltaMs, state) {
      lidar.rotation.y += deltaMs * (state.cleaning ? 0.006 : 0.0012);
    },
    dispose() {
      disposeGroup(object);
    },
  };
};

const sensorHero = (): HeroHandle => {
  const object = new Group();
  const glowMaterial = shell(0xd8b48a, { emissive: 0xd8b48a, emissiveIntensity: 0.25 });
  const puck = new Mesh(new CylinderGeometry(0.5, 0.5, 0.16, 64), shell(0xd7d0c6));
  const window = new Mesh(new CylinderGeometry(0.2, 0.2, 0.18, 48), glowMaterial);
  object.add(puck, window);
  return {
    object,
    apply() {},
    tick() {},
    dispose() {
      disposeGroup(object);
    },
  };
};

const applianceHero = (): HeroHandle => {
  const object = new Group();
  const glowMaterial = shell(0xd8b48a, { emissive: 0xd8b48a, emissiveIntensity: 0 });
  const plate = new Mesh(new BoxGeometry(0.9, 1.2, 0.12), shell(0xd7d0c6));
  const rocker = new Mesh(new BoxGeometry(0.44, 0.72, 0.08), glowMaterial);
  rocker.position.z = 0.09;
  object.add(plate, rocker);
  return {
    object,
    apply(state) {
      glowMaterial.emissiveIntensity = state.on ? 0.5 : 0;
      rocker.rotation.x = state.on ? -0.16 : 0.16;
    },
    tick() {},
    dispose() {
      disposeGroup(object);
    },
  };
};

export const createHero = (
  category: DeviceCategory,
  capabilities: readonly string[],
): HeroHandle => {
  switch (category) {
    case 'light':
      return lightHero();
    case 'climate':
      return climateHero();
    case 'cover':
      return coverHero();
    case 'media':
      return mediaHero();
    case 'security':
      return securityHero(capabilities.includes('lock'));
    case 'cleaning':
      return cleaningHero();
    case 'sensor':
      return sensorHero();
    case 'appliance':
      return applianceHero();
  }
};
