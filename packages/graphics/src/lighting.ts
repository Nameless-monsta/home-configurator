import { AmbientLight, DirectionalLight, Group, HemisphereLight } from 'three';

import type { QualityProfile } from './quality-manager.js';

export class StudioLightingRig extends Group {
  public readonly ambient = new AmbientLight(0xffffff, 0.42);
  public readonly hemisphere = new HemisphereLight(0xd8d4cc, 0x171513, 0.95);
  public readonly key = new DirectionalLight(0xfff4e6, 3.1);
  public readonly fill = new DirectionalLight(0xc8d4ff, 0.9);
  public readonly rim = new DirectionalLight(0xffdfc4, 1.15);

  public constructor() {
    super();
    this.name = 'home-configurator.lighting';

    this.key.position.set(4, 5, 5);
    this.fill.position.set(-4, 1.5, 2);
    this.rim.position.set(1.5, 3, -5);
    this.key.castShadow = true;
    this.key.shadow.bias = -0.00025;
    this.key.shadow.normalBias = 0.025;
    this.key.shadow.camera.near = 0.1;
    this.key.shadow.camera.far = 30;

    this.add(this.ambient, this.hemisphere, this.key, this.fill, this.rim);
  }

  public applyQuality(profile: QualityProfile): void {
    this.key.castShadow = profile.shadows;
    this.key.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    this.key.shadow.needsUpdate = true;
    this.rim.intensity = profile.shadows ? 1.15 : 0.85;
  }
}
