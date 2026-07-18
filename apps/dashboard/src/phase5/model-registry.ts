/**
 * Hero model registry — presentation-layer resolution of a device to its 3D
 * representation, following docs/02-architecture/2.7-model-registry.md
 * matching priority: explicit user override → manufacturer/model alias →
 * category fallback (the procedural heroes). Overrides are persisted locally;
 * they are visual configuration only and never touch device state.
 */

import type { Object3D } from 'three';

export type ModelSource = 'procedural' | 'url';

export interface ModelOverride {
  readonly source: ModelSource;
  readonly url: string;
  readonly scale: number;
  readonly rotationYDeg: number;
  readonly offsetY: number;
}

export const defaultOverride = (): ModelOverride => ({
  source: 'procedural',
  url: '',
  scale: 1,
  rotationYDeg: 0,
  offsetY: 0,
});

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

/** Validate and normalise persisted or user-entered override data. */
export const normalizeOverride = (raw: unknown): ModelOverride => {
  const base = defaultOverride();
  if (typeof raw !== 'object' || raw === null) return base;
  const record = raw as Record<string, unknown>;
  const url = typeof record['url'] === 'string' ? record['url'].trim() : '';
  const source: ModelSource = record['source'] === 'url' && url !== '' ? 'url' : 'procedural';
  return {
    source,
    url,
    scale: clampNumber(record['scale'], 0.2, 4, base.scale),
    rotationYDeg: clampNumber(record['rotationYDeg'], -360, 360, base.rotationYDeg),
    offsetY: clampNumber(record['offsetY'], -1.5, 1.5, base.offsetY),
  };
};

/**
 * Manufacturer/model alias table. Entries map a lowercase
 * `${manufacturer}::${model}` (or `${manufacturer}::*`) key to a bundled GLB
 * URI. The table ships empty of proprietary assets; installations extend it
 * through user overrides or by hosting their own models.
 */
export type AliasTable = Readonly<Record<string, string>>;

export interface ResolvedModel {
  readonly kind: 'override' | 'alias' | 'fallback';
  readonly override: ModelOverride;
}

/** Pure resolution following the registry matching priority. */
export const resolveModel = (
  deviceId: string,
  overrides: Readonly<Record<string, ModelOverride>>,
  manufacturer?: string,
  model?: string,
  aliases: AliasTable = {},
): ResolvedModel => {
  const override = overrides[deviceId];
  if (override && override.source === 'url' && override.url) {
    return { kind: 'override', override };
  }
  const maker = manufacturer?.trim().toLowerCase() ?? '';
  if (maker) {
    const exact = aliases[`${maker}::${model?.trim().toLowerCase() ?? ''}`];
    const family = aliases[`${maker}::*`];
    const uri = exact ?? family;
    if (uri) {
      return {
        kind: 'alias',
        override: { ...(override ?? defaultOverride()), source: 'url', url: uri },
      };
    }
  }
  return { kind: 'fallback', override: override ?? defaultOverride() };
};

/** Apply scale, rotation and vertical anchor adjustments to a mounted object. */
export const applyOverrideTransform = (object: Object3D, override: ModelOverride): void => {
  object.scale.setScalar(override.scale);
  object.rotation.y = (override.rotationYDeg * Math.PI) / 180;
  object.position.y = override.offsetY;
};

export interface OverrideStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = 'home-configurator.model-overrides.v1';

export class HeroModelRegistry {
  readonly #storage: OverrideStorage | null;
  readonly #aliases: AliasTable;
  #overrides: Record<string, ModelOverride>;

  public constructor(storage?: OverrideStorage | null, aliases: AliasTable = {}) {
    this.#storage = storage ?? null;
    this.#aliases = aliases;
    this.#overrides = this.#load();
  }

  public get(deviceId: string): ModelOverride {
    return this.#overrides[deviceId] ?? defaultOverride();
  }

  public has(deviceId: string): boolean {
    return deviceId in this.#overrides;
  }

  public set(deviceId: string, override: ModelOverride): void {
    this.#overrides = { ...this.#overrides, [deviceId]: normalizeOverride(override) };
    this.#persist();
  }

  public clear(deviceId: string): void {
    if (!(deviceId in this.#overrides)) return;
    const next = { ...this.#overrides };
    delete next[deviceId];
    this.#overrides = next;
    this.#persist();
  }

  public resolve(deviceId: string, manufacturer?: string, model?: string): ResolvedModel {
    return resolveModel(deviceId, this.#overrides, manufacturer, model, this.#aliases);
  }

  #load(): Record<string, ModelOverride> {
    if (!this.#storage) return {};
    try {
      const raw = this.#storage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return {};
      const result: Record<string, ModelOverride> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        result[key] = normalizeOverride(value);
      }
      return result;
    } catch {
      return {};
    }
  }

  #persist(): void {
    try {
      this.#storage?.setItem(STORAGE_KEY, JSON.stringify(this.#overrides));
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  }
}
