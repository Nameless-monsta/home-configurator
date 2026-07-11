import { Group, type Object3D, type Scene } from 'three';

import type { SceneNodeDescriptor } from './types.js';

export class SceneGraph {
  readonly #scene: Scene;
  readonly #root = new Group();
  readonly #nodes = new Map<string, Object3D>();

  public constructor(scene: Scene) {
    this.#scene = scene;
    this.#root.name = 'home-configurator.root';
    this.#scene.add(this.#root);
  }

  public add(descriptor: SceneNodeDescriptor): Object3D {
    if (this.#nodes.has(descriptor.id)) {
      throw new Error(`Scene node already exists: ${descriptor.id}`);
    }

    const parent = descriptor.parentId ? this.#nodes.get(descriptor.parentId) : this.#root;
    if (!parent) throw new Error(`Scene parent not found: ${descriptor.parentId}`);

    descriptor.object.name = descriptor.id;
    descriptor.object.visible = descriptor.visible ?? true;
    parent.add(descriptor.object);
    this.#nodes.set(descriptor.id, descriptor.object);
    return descriptor.object;
  }

  public get(id: string): Object3D | undefined {
    return this.#nodes.get(id);
  }

  public remove(id: string): boolean {
    const object = this.#nodes.get(id);
    if (!object) return false;

    for (const descendant of [...object.children]) {
      if (descendant.name) this.remove(descendant.name);
    }
    object.removeFromParent();
    this.#nodes.delete(id);
    return true;
  }

  public clear(): void {
    for (const id of [...this.#nodes.keys()]) this.remove(id);
  }

  public ids(): readonly string[] {
    return [...this.#nodes.keys()];
  }
}
