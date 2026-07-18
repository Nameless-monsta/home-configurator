/**
 * Thermostat ring — drag around the dial perimeter to set target temperature.
 * 0.5 °C magnetic detents, angular resistance. Emits continuous updates during
 * the drag and a final commit on release. docs/PHASE-5-IYO-EXPERIENCE §5.5.
 */

import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Raycaster,
  Vector2,
  type Camera,
  type Group,
} from 'three';

export interface ThermostatRingOptions {
  readonly hero: Group;
  readonly min?: number;
  readonly max?: number;
  onChange: (targetTemp: number, final: boolean) => void;
}

export class ThermostatRing {
  readonly #raycaster = new Raycaster();
  readonly #plane: Mesh;
  readonly #min: number;
  readonly #max: number;
  readonly #onChange: ThermostatRingOptions['onChange'];
  #dragging = false;
  #lastAngle = 0;
  #value: number;

  public constructor(options: ThermostatRingOptions) {
    this.#min = options.min ?? 16;
    this.#max = options.max ?? 30;
    this.#value = (this.#min + this.#max) / 2;
    this.#onChange = options.onChange;
    this.#plane = new Mesh(new PlaneGeometry(3.2, 3.2), new MeshBasicMaterial({ visible: false }));
    options.hero.add(this.#plane);
  }

  public setValue(value: number): void {
    this.#value = Math.min(this.#max, Math.max(this.#min, value));
  }

  public bind(surface: HTMLElement, camera: Camera): () => void {
    const angleAt = (event: PointerEvent): number | null => {
      const rect = surface.getBoundingClientRect();
      const ndc = new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
      this.#raycaster.setFromCamera(ndc, camera);
      const hit = this.#raycaster.intersectObject(this.#plane, false)[0];
      if (!hit) return null;
      const local = this.#plane.worldToLocal(hit.point.clone());
      return Math.atan2(local.y, local.x);
    };
    const onDown = (event: PointerEvent): void => {
      const angle = angleAt(event);
      if (angle === null) return;
      this.#dragging = true;
      this.#lastAngle = angle;
      surface.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent): void => {
      if (!this.#dragging) return;
      const angle = angleAt(event);
      if (angle === null) return;
      let delta = angle - this.#lastAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      this.#lastAngle = angle;
      const range = this.#max - this.#min;
      const next = this.#value + (-delta / ((Math.PI * 4) / 3)) * range;
      const detented = Math.round(next * 2) / 2;
      const clamped = Math.min(this.#max, Math.max(this.#min, detented));
      if (clamped !== this.#value) {
        this.#value = clamped;
        this.#onChange(clamped, false);
      } else {
        this.#value = Math.min(this.#max, Math.max(this.#min, next));
      }
    };
    const onUp = (event: PointerEvent): void => {
      if (this.#dragging) {
        this.#value = Math.round(this.#value * 2) / 2;
        this.#onChange(this.#value, true);
      }
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
    this.#plane.removeFromParent();
    this.#plane.geometry.dispose();
    (this.#plane.material as MeshBasicMaterial).dispose();
  }
}
