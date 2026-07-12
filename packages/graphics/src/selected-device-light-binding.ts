import type {
  DeviceRuntimeSnapshot,
  DeviceStore,
  RuntimeUnsubscribe,
} from '@home-configurator/runtime';
import {
  Color,
  Mesh,
  MeshPhysicalMaterial,
  PointLight,
  type Object3D,
} from 'three';

export interface SelectedDeviceLightBindingOptions {
  readonly store: DeviceStore;
  readonly model: Object3D;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const numericState = (snapshot: DeviceRuntimeSnapshot, key: string, fallback: number): number => {
  const value = snapshot.effectiveState[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const booleanState = (snapshot: DeviceRuntimeSnapshot, key: string, fallback: boolean): boolean => {
  const value = snapshot.effectiveState[key];
  return typeof value === 'boolean' ? value : fallback;
};

const lightColor = (snapshot: DeviceRuntimeSnapshot): Color => {
  const value = snapshot.effectiveState['color'];
  if (Array.isArray(value) && value.length >= 2) {
    const hue = typeof value[0] === 'number' ? clamp(value[0], 0, 360) : 35;
    const saturation = typeof value[1] === 'number' ? clamp(value[1], 0, 100) : 65;
    return new Color().setHSL(hue / 360, saturation / 100, 0.62);
  }
  return new Color(0xffc987);
};

export class SelectedDeviceLightBinding {
  readonly #store: DeviceStore;
  readonly #model: Object3D;
  readonly #bulb: Mesh | null;
  readonly #glow: PointLight | null;
  readonly #unsubscribe: RuntimeUnsubscribe;
  #selectedDeviceId: string | null = null;

  public constructor(options: SelectedDeviceLightBindingOptions) {
    this.#store = options.store;
    this.#model = options.model;
    const bulb = options.model.getObjectByName('hero.fallback.bulb');
    const glow = options.model.getObjectByName('hero.fallback.glow');
    this.#bulb = bulb instanceof Mesh ? bulb : null;
    this.#glow = glow instanceof PointLight ? glow : null;
    this.#unsubscribe = this.#store.subscribe((patch) => {
      if (patch.deviceId === this.#selectedDeviceId) this.#refresh();
    });
    this.#apply(null);
  }

  public setSelectedDevice(deviceId: string | null): void {
    if (deviceId === this.#selectedDeviceId) return;
    if (this.#selectedDeviceId !== null && this.#store.get(this.#selectedDeviceId) !== null) {
      this.#store.setSelected(this.#selectedDeviceId, false);
    }
    this.#selectedDeviceId = deviceId;
    if (deviceId !== null && this.#store.get(deviceId) !== null) {
      this.#store.setSelected(deviceId, true);
    }
    this.#refresh();
  }

  public dispose(): void {
    this.#unsubscribe();
    if (this.#selectedDeviceId !== null && this.#store.get(this.#selectedDeviceId) !== null) {
      this.#store.setSelected(this.#selectedDeviceId, false);
    }
    this.#selectedDeviceId = null;
  }

  #refresh(): void {
    const snapshot =
      this.#selectedDeviceId === null ? null : this.#store.get(this.#selectedDeviceId)?.snapshot() ?? null;
    this.#apply(snapshot);
  }

  #apply(snapshot: DeviceRuntimeSnapshot | null): void {
    const available = snapshot?.available ?? false;
    const connected = snapshot?.connected ?? false;
    const power = snapshot === null ? false : booleanState(snapshot, 'power', false);
    const brightness = snapshot === null ? 0 : clamp(numericState(snapshot, 'brightness', 1), 0, 1);
    const pending = snapshot?.pendingCommandId !== undefined;
    const color = snapshot === null ? new Color(0x8f887f) : lightColor(snapshot);
    const active = available && connected && power;

    this.#model.userData['deviceId'] = snapshot?.id ?? null;
    this.#model.userData['available'] = available;
    this.#model.userData['connected'] = connected;
    this.#model.userData['pending'] = pending;
    this.#model.scale.setScalar(snapshot === null ? 0.96 : pending ? 1.035 : 1);

    if (this.#bulb !== null && this.#bulb.material instanceof MeshPhysicalMaterial) {
      const material = this.#bulb.material;
      material.color.copy(available ? color : new Color(0x777777));
      material.emissive.copy(color);
      material.emissiveIntensity = active ? 0.35 + brightness * 2.4 + (pending ? 0.35 : 0) : 0;
      material.opacity = available ? 1 : 0.48;
      material.transparent = !available;
      material.needsUpdate = true;
    }

    if (this.#glow !== null) {
      this.#glow.color.copy(color);
      this.#glow.intensity = active ? 1.5 + brightness * 7 + (pending ? 1.2 : 0) : 0;
      this.#glow.distance = active ? 3 + brightness * 3 : 0;
    }
  }
}
