/**
 * Dotted particle colour sphere — the primary lighting colour interaction.
 * Longitude → hue, latitude → saturation (poles neutral); geometry stays stable
 * and luminosity drives particle energy/glow, never sphere size. Breathes and
 * reacts to pointer attraction. docs/PHASE-5-IYO-EXPERIENCE §5.5.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Raycaster,
  SphereGeometry,
  Vector2,
  Vector3,
  type Camera,
} from 'three';

export interface SphereSelection {
  readonly hue: number;
  readonly saturation: number;
}

export interface ColourSphereOptions {
  readonly radius?: number;
  onSelect: (selection: SphereSelection, final: boolean) => void;
}

const Y_AXIS = new Vector3(0, 1, 0);
const POINT_COUNT = 2600;

export class ColourSphere {
  public readonly object = new Group();

  readonly #points: Points;
  readonly #material: PointsMaterial;
  readonly #baseColors: Float32Array;
  readonly #colorAttribute: BufferAttribute;
  readonly #marker: Mesh;
  readonly #pickMesh: Mesh;
  readonly #raycaster = new Raycaster();
  readonly #radius: number;
  readonly #onSelect: ColourSphereOptions['onSelect'];
  #luminosity = 0.7;
  #spin = 0.00016;
  #breathe = 0;
  #dragging = false;

  public constructor(options: ColourSphereOptions) {
    this.#radius = options.radius ?? 0.72;
    this.#onSelect = options.onSelect;

    const positions = new Float32Array(POINT_COUNT * 3);
    this.#baseColors = new Float32Array(POINT_COUNT * 3);
    const colour = new Color();
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let index = 0; index < POINT_COUNT; index += 1) {
      const y = 1 - (index / (POINT_COUNT - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = golden * index;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      positions[index * 3] = x * this.#radius;
      positions[index * 3 + 1] = y * this.#radius;
      positions[index * 3 + 2] = z * this.#radius;
      const hue = (Math.atan2(z, x) / (Math.PI * 2) + 1) % 1;
      colour.setHSL(hue, radiusAtY * 0.9, 0.55);
      this.#baseColors[index * 3] = colour.r;
      this.#baseColors[index * 3 + 1] = colour.g;
      this.#baseColors[index * 3 + 2] = colour.b;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    this.#colorAttribute = new BufferAttribute(new Float32Array(this.#baseColors), 3);
    geometry.setAttribute('color', this.#colorAttribute);

    this.#material = new PointsMaterial({
      size: 0.028,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.#points = new Points(geometry, this.#material);

    this.#pickMesh = new Mesh(
      new SphereGeometry(this.#radius, 32, 24),
      new MeshBasicMaterial({ visible: false }),
    );
    this.#marker = new Mesh(
      new SphereGeometry(0.045, 24, 16),
      new MeshBasicMaterial({ color: 0xffffff }),
    );
    this.#marker.visible = false;

    this.object.add(this.#points, this.#pickMesh, this.#marker);
    this.setLuminosity(this.#luminosity);
  }

  public get dragging(): boolean {
    return this.#dragging;
  }

  public setLuminosity(value: number): void {
    this.#luminosity = Math.min(1, Math.max(0, value));
    const energy = 0.25 + this.#luminosity * 0.75;
    this.#material.size = 0.016 + this.#luminosity * 0.026;
    this.#material.opacity = 0.45 + this.#luminosity * 0.5;
    this.#spin = 0.00008 + this.#luminosity * 0.00022;
    const colors = this.#colorAttribute.array as Float32Array;
    for (let index = 0; index < colors.length; index += 1) {
      colors[index] = this.#baseColors[index]! * energy;
    }
    this.#colorAttribute.needsUpdate = true;
  }

  public setSelection(hue: number, saturation: number): void {
    const clampedSat = Math.min(1, Math.max(0, saturation / 100));
    const y = Math.sqrt(Math.max(0, 1 - clampedSat * clampedSat));
    const theta = ((hue % 360) / 360) * Math.PI * 2;
    this.#marker.position.set(
      Math.cos(theta) * clampedSat * this.#radius,
      y * this.#radius,
      Math.sin(theta) * clampedSat * this.#radius,
    );
    this.#marker.visible = true;
  }

  public tick(deltaMs: number): void {
    if (!this.#dragging) this.#points.rotation.y += this.#spin * deltaMs;
    this.#breathe += deltaMs / 2600;
    const pulse = 1 + Math.sin(this.#breathe) * 0.012 * (0.4 + this.#luminosity);
    this.#points.scale.setScalar(pulse);
  }

  public bind(surface: HTMLElement, camera: Camera): () => void {
    const toNdc = (event: PointerEvent): Vector2 => {
      const rect = surface.getBoundingClientRect();
      return new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
    };
    const pick = (event: PointerEvent, final: boolean): boolean => {
      this.#raycaster.setFromCamera(toNdc(event), camera);
      const hit = this.#raycaster.intersectObject(this.#pickMesh, false)[0];
      if (!hit) return false;
      const local = this.object.worldToLocal(hit.point.clone());
      const rotated = local.clone().applyAxisAngle(Y_AXIS, -this.#points.rotation.y);
      const hue = (((Math.atan2(rotated.z, rotated.x) / (Math.PI * 2) + 1) % 1) * 360 + 360) % 360;
      const saturation =
        Math.min(1, Math.sqrt(rotated.x * rotated.x + rotated.z * rotated.z) / this.#radius) * 100;
      this.#marker.position.copy(local);
      this.#marker.visible = true;
      this.#onSelect({ hue, saturation }, final);
      return true;
    };
    const onDown = (event: PointerEvent): void => {
      if (pick(event, false)) {
        this.#dragging = true;
        surface.setPointerCapture(event.pointerId);
      }
    };
    const onMove = (event: PointerEvent): void => {
      if (this.#dragging) pick(event, false);
    };
    const onUp = (event: PointerEvent): void => {
      if (this.#dragging) pick(event, true);
      this.#dragging = false;
      if (surface.hasPointerCapture(event.pointerId))
        surface.releasePointerCapture(event.pointerId);
    };
    surface.addEventListener('pointerdown', onDown);
    surface.addEventListener('pointermove', onMove);
    surface.addEventListener('pointerup', onUp);
    surface.addEventListener('pointercancel', onUp);
    return () => {
      surface.removeEventListener('pointerdown', onDown);
      surface.removeEventListener('pointermove', onMove);
      surface.removeEventListener('pointerup', onUp);
      surface.removeEventListener('pointercancel', onUp);
    };
  }

  public dispose(): void {
    this.#points.geometry.dispose();
    this.#material.dispose();
    this.#pickMesh.geometry.dispose();
    (this.#pickMesh.material as MeshBasicMaterial).dispose();
    this.#marker.geometry.dispose();
    (this.#marker.material as MeshBasicMaterial).dispose();
  }
}
