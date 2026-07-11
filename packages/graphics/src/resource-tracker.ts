import { BufferGeometry, Mesh, Texture, type Material, type Object3D } from 'three';

export interface DisposableGraphicsResource {
  dispose(): void;
}

export class ResourceTracker {
  readonly #resources = new Set<DisposableGraphicsResource>();

  public track<T extends DisposableGraphicsResource>(resource: T): T {
    this.#resources.add(resource);
    return resource;
  }

  public untrack(resource: DisposableGraphicsResource): void {
    this.#resources.delete(resource);
  }

  public trackObject<T extends Object3D>(root: T): T {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const mesh = object as Mesh<BufferGeometry, Material | Material[]>;
      if (mesh.geometry instanceof BufferGeometry) this.track(mesh.geometry);
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) this.#trackMaterial(material);
    });
    return root;
  }

  public get size(): number {
    return this.#resources.size;
  }

  public disposeAll(): number {
    const resources = [...this.#resources];
    this.#resources.clear();
    for (const resource of resources.reverse()) resource.dispose();
    return resources.length;
  }

  #trackMaterial(material: Material): void {
    this.track(material);
    for (const value of Object.values(material as unknown as Record<string, unknown>)) {
      if (value instanceof Texture) this.track(value);
    }
  }
}
