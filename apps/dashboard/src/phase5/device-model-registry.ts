import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Sphere,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { DeviceCategory, DeviceView, DeviceViewState } from './experience-model.js';
import { createHero, type HeroHandle } from './hero-models.js';

export type DeviceModelSource = 'automatic' | 'library' | 'url' | 'upload' | 'procedural';

export interface DeviceModelTransform {
  readonly scale: number;
  readonly rotation: readonly [number, number, number];
  readonly offset: readonly [number, number, number];
  readonly roughness: number;
  readonly metalness: number;
  readonly tint: string;
}

export interface DeviceModelConfig {
  readonly source: DeviceModelSource;
  readonly libraryId?: string;
  readonly url?: string;
  readonly uploadId?: string;
  readonly transform: DeviceModelTransform;
}

export interface DeviceModelLibraryEntry {
  readonly id: string;
  readonly label: string;
  readonly category: DeviceCategory;
  readonly manufacturers?: readonly string[];
  readonly models?: readonly string[];
  readonly url?: string;
  readonly transform?: Partial<DeviceModelTransform>;
}

export interface ResolvedDeviceModel {
  readonly source: Exclude<DeviceModelSource, 'automatic'>;
  readonly label: string;
  readonly url?: string;
  readonly transform: DeviceModelTransform;
}

const DEFAULT_TRANSFORM: DeviceModelTransform = {
  scale: 1,
  rotation: [0, 0, 0],
  offset: [0, 0, 0],
  roughness: 0.42,
  metalness: 0.12,
  tint: '#ffffff',
};

const LIBRARY: readonly DeviceModelLibraryEntry[] = [
  { id: 'light-pendant', label: 'Pendant light', category: 'light', models: ['pendant', 'ceiling'] },
  { id: 'light-floor', label: 'Floor lamp', category: 'light', models: ['floor', 'lamp'] },
  { id: 'thermostat-round', label: 'Round thermostat', category: 'climate', models: ['nest', 'round'] },
  { id: 'thermostat-panel', label: 'Climate panel', category: 'climate', models: ['panel', 'thermostat'] },
  { id: 'curtain-track', label: 'Curtain system', category: 'cover', models: ['curtain', 'shade', 'blind'] },
  { id: 'television', label: 'Television', category: 'media', models: ['tv', 'television', 'screen'] },
  { id: 'speaker', label: 'Speaker', category: 'media', models: ['speaker', 'sonos', 'homepod'] },
  { id: 'vacuum-roborock', label: 'Roborock vacuum', category: 'cleaning', manufacturers: ['roborock'] },
  { id: 'vacuum-disc', label: 'Robot vacuum', category: 'cleaning', models: ['vacuum', 'roomba'] },
  { id: 'camera', label: 'Security camera', category: 'security', models: ['camera'] },
  { id: 'door-lock', label: 'Smart lock', category: 'security', models: ['lock'] },
  { id: 'air-purifier', label: 'Air purifier', category: 'appliance', models: ['purifier', 'air'] },
  { id: 'wall-switch', label: 'Wall switch', category: 'appliance', models: ['switch'] },
  { id: 'presence-sensor', label: 'Presence sensor', category: 'sensor', models: ['presence', 'motion', 'sensor'] },
];

const STORAGE_KEY = 'home-configurator.device-models.v1';
const DB_NAME = 'home-configurator-models';
const DB_STORE = 'uploads';

export class DeviceModelRegistry {
  readonly #loader = new GLTFLoader();
  readonly #configs = new Map<string, DeviceModelConfig>();
  readonly #previews = new Map<string, DeviceModelConfig>();
  #revision = 0;

  public constructor() {
    this.#load();
  }

  public get revision(): number {
    return this.#revision;
  }

  public library(category?: DeviceCategory): readonly DeviceModelLibraryEntry[] {
    return category ? LIBRARY.filter((entry) => entry.category === category) : LIBRARY;
  }

  public config(deviceId: string): DeviceModelConfig {
    return this.#previews.get(deviceId) ?? this.#configs.get(deviceId) ?? this.defaultConfig();
  }

  public defaultConfig(): DeviceModelConfig {
    return { source: 'automatic', transform: DEFAULT_TRANSFORM };
  }

  public setPreview(deviceId: string, config: DeviceModelConfig): void {
    this.#previews.set(deviceId, normaliseConfig(config));
    this.#revision += 1;
  }

  public clearPreview(deviceId: string): void {
    if (this.#previews.delete(deviceId)) this.#revision += 1;
  }

  public save(deviceId: string, config: DeviceModelConfig): void {
    this.#configs.set(deviceId, normaliseConfig(config));
    this.#previews.delete(deviceId);
    this.#revision += 1;
    this.#persist();
  }

  public reset(deviceId: string): void {
    this.#configs.delete(deviceId);
    this.#previews.delete(deviceId);
    this.#revision += 1;
    this.#persist();
  }

  public async saveUpload(deviceId: string, file: File): Promise<string> {
    const id = `${deviceId}:${Date.now()}:${file.name}`;
    await writeUpload(id, file);
    return id;
  }

  public resolve(view: DeviceView): ResolvedDeviceModel {
    const configured = this.config(view.id);
    let source = configured.source;
    let entry: DeviceModelLibraryEntry | undefined;
    if (source === 'automatic') {
      entry = this.#automaticMatch(view);
      source = entry?.url ? 'url' : entry ? 'library' : 'procedural';
    } else if (source === 'library') {
      entry = LIBRARY.find((candidate) => candidate.id === configured.libraryId);
    }

    const transform = mergeTransform(DEFAULT_TRANSFORM, entry?.transform, configured.transform);
    if (source === 'url') {
      const url = configured.url ?? entry?.url;
      return url
        ? { source: 'url', label: entry?.label ?? 'External model', url, transform }
        : { source: 'procedural', label: 'Procedural fallback', transform };
    }
    if (source === 'upload' && configured.uploadId)
      return { source: 'upload', label: 'Uploaded model', url: configured.uploadId, transform };
    if (source === 'library' && entry?.url)
      return { source: 'url', label: entry.label, url: entry.url, transform };
    if (source === 'library' && entry)
      return { source: 'procedural', label: entry.label, transform };
    return { source: 'procedural', label: 'Procedural fallback', transform };
  }

  public async createHero(view: DeviceView): Promise<HeroHandle> {
    const resolved = this.resolve(view);
    if ((resolved.source === 'url' || resolved.source === 'upload') && resolved.url) {
      try {
        const url = resolved.source === 'upload' ? await uploadObjectUrl(resolved.url) : resolved.url;
        if (url) return await this.#externalHero(url, resolved.transform, view.state);
      } catch {
        // Fall through to the production-safe procedural model.
      }
    }
    const fallback = createHero(view.category, view.capabilities);
    applyTransform(fallback.object, resolved.transform);
    tuneMaterials(fallback.object, resolved.transform);
    return fallback;
  }

  #automaticMatch(view: DeviceView): DeviceModelLibraryEntry | undefined {
    const manufacturer = (view.manufacturer ?? '').toLowerCase();
    const model = `${view.model ?? ''} ${view.name}`.toLowerCase();
    return LIBRARY.find((entry) => {
      if (entry.category !== view.category) return false;
      const manufacturerMatch = entry.manufacturers?.some((value) => manufacturer.includes(value));
      const modelMatch = entry.models?.some((value) => model.includes(value));
      return Boolean(manufacturerMatch || modelMatch);
    });
  }

  async #externalHero(
    url: string,
    transform: DeviceModelTransform,
    initialState: DeviceViewState,
  ): Promise<HeroHandle> {
    const gltf = await this.#loader.loadAsync(url);
    const object = new Group();
    const scene = gltf.scene;
    normaliseScene(scene);
    object.add(scene);
    applyTransform(object, transform);
    tuneMaterials(object, transform);
    applyExternalState(object, initialState);
    return {
      object,
      apply: (state) => applyExternalState(object, state),
      tick: (deltaMs, state) => {
        if (state.cleaning) object.rotation.y += deltaMs * 0.00018;
      },
      dispose: () => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        disposeObject(object);
      },
    };
  }

  #load(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, DeviceModelConfig>;
      for (const [id, config] of Object.entries(value)) this.#configs.set(id, normaliseConfig(config));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  #persist(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.#configs)));
  }
}

const normaliseConfig = (value: DeviceModelConfig): DeviceModelConfig => ({
  source: value.source,
  ...(value.libraryId ? { libraryId: value.libraryId } : {}),
  ...(value.url ? { url: value.url } : {}),
  ...(value.uploadId ? { uploadId: value.uploadId } : {}),
  transform: mergeTransform(DEFAULT_TRANSFORM, value.transform),
});

const mergeTransform = (
  ...values: Array<Partial<DeviceModelTransform> | undefined>
): DeviceModelTransform => {
  let scale = DEFAULT_TRANSFORM.scale;
  let rotation = DEFAULT_TRANSFORM.rotation;
  let offset = DEFAULT_TRANSFORM.offset;
  let roughness = DEFAULT_TRANSFORM.roughness;
  let metalness = DEFAULT_TRANSFORM.metalness;
  let tint = DEFAULT_TRANSFORM.tint;
  for (const value of values) {
    if (!value) continue;
    scale = value.scale ?? scale;
    rotation = value.rotation ?? rotation;
    offset = value.offset ?? offset;
    roughness = value.roughness ?? roughness;
    metalness = value.metalness ?? metalness;
    tint = value.tint ?? tint;
  }
  return {
    scale: finite(scale, 1),
    rotation: tuple(rotation, [0, 0, 0]),
    offset: tuple(offset, [0, 0, 0]),
    roughness: clamp(finite(roughness, 0.42), 0, 1),
    metalness: clamp(finite(metalness, 0.12), 0, 1),
    tint,
  };
};

const tuple = (
  value: readonly number[] | undefined,
  fallback: readonly [number, number, number],
): [number, number, number] => [
  finite(value?.[0], fallback[0]),
  finite(value?.[1], fallback[1]),
  finite(value?.[2], fallback[2]),
];
const finite = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const applyTransform = (object: Object3D, transform: DeviceModelTransform): void => {
  object.scale.setScalar(Math.max(0.02, transform.scale));
  object.rotation.set(...transform.rotation);
  object.position.set(...transform.offset);
};

const normaliseScene = (object: Object3D): void => {
  const bounds = new Box3().setFromObject(object);
  if (bounds.isEmpty()) return;
  const sphere = bounds.getBoundingSphere(new Sphere());
  const scale = sphere.radius > 0 ? 1.25 / sphere.radius : 1;
  object.scale.setScalar(scale);
  const centre = bounds.getCenter(new Vector3()).multiplyScalar(scale);
  object.position.sub(centre);
};

const tuneMaterials = (object: Object3D, transform: DeviceModelTransform): void => {
  const tint = new Color(transform.tint);
  object.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial || material instanceof MeshPhysicalMaterial) {
        material.roughness = transform.roughness;
        material.metalness = transform.metalness;
        material.color.multiply(tint);
        material.needsUpdate = true;
      }
    }
  });
};

const applyExternalState = (object: Object3D, state: DeviceViewState): void => {
  object.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      material.emissiveIntensity = state.on ? 0.08 + state.brightness * 0.28 : 0;
    }
  });
};

const disposeObject = (object: Object3D): void => {
  object.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const mesh = node as Mesh;
    mesh.geometry.dispose();
    const material = mesh.material as Material | Material[];
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => entry.dispose());
  });
};

const openUploadDb = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

const writeUpload = async (id: string, file: Blob): Promise<void> => {
  const db = await openUploadDb();
  if (!db) throw new Error('Model uploads are not available in this browser');
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(file, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Unable to save model'));
  });
  db.close();
};

const uploadObjectUrl = async (id: string): Promise<string | undefined> => {
  const db = await openUploadDb();
  if (!db) return undefined;
  const blob = await new Promise<Blob | undefined>((resolve) => {
    const request = db.transaction(DB_STORE).objectStore(DB_STORE).get(id);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : undefined);
    request.onerror = () => resolve(undefined);
  });
  db.close();
  return blob ? URL.createObjectURL(blob) : undefined;
};
