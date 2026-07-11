import { Raycaster, Vector2, type Camera, type Object3D } from 'three';

import type { Diagnostics } from '@home-configurator/runtime';

import type { SelectionSnapshot } from './types.js';

export class SelectionEngine {
  readonly #camera: Camera;
  readonly #diagnostics: Diagnostics;
  readonly #raycaster = new Raycaster();
  readonly #pointer = new Vector2();
  readonly #objects = new Map<string, Object3D>();
  #selectedId: string | undefined;
  #hoveredId: string | undefined;

  public constructor(camera: Camera, diagnostics: Diagnostics) {
    this.#camera = camera;
    this.#diagnostics = diagnostics;
  }

  public register(id: string, object: Object3D): () => void {
    if (this.#objects.has(id)) throw new Error(`Selectable already registered: ${id}`);
    object.userData['semanticId'] = id;
    this.#objects.set(id, object);
    return () => {
      this.#objects.delete(id);
      if (this.#selectedId === id) this.#selectedId = undefined;
      if (this.#hoveredId === id) this.#hoveredId = undefined;
    };
  }

  public hitTest(x: number, y: number, width: number, height: number): string | undefined {
    this.#pointer.set((x / Math.max(1, width)) * 2 - 1, -(y / Math.max(1, height)) * 2 + 1);
    this.#raycaster.setFromCamera(this.#pointer, this.#camera);
    const intersections = this.#raycaster.intersectObjects([...this.#objects.values()], true);
    for (const intersection of intersections) {
      let object: Object3D | null = intersection.object;
      while (object) {
        const semanticId: unknown = object.userData['semanticId'];
        if (typeof semanticId === 'string' && this.#objects.has(semanticId)) return semanticId;
        object = object.parent;
      }
    }
    return undefined;
  }

  public select(id?: string): void {
    if (id !== undefined && !this.#objects.has(id)) throw new Error(`Selectable not found: ${id}`);
    this.#selectedId = id;
    this.#diagnostics.setGauge('interaction.selection', id ? 1 : 0);
    this.#diagnostics.record('debug', 'interaction.selection', 'Selection changed', {
      id: id ?? null,
    });
  }

  public hover(id?: string): void {
    if (id !== undefined && !this.#objects.has(id)) return;
    this.#hoveredId = id;
  }

  public get selectedObject(): Object3D | undefined {
    return this.#selectedId ? this.#objects.get(this.#selectedId) : undefined;
  }

  public snapshot(): SelectionSnapshot {
    return {
      ...(this.#selectedId ? { selectedId: this.#selectedId } : {}),
      ...(this.#hoveredId ? { hoveredId: this.#hoveredId } : {}),
    };
  }

  public clear(): void {
    this.#objects.clear();
    this.#selectedId = undefined;
    this.#hoveredId = undefined;
  }
}
