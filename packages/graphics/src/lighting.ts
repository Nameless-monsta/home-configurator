import { AmbientLight, DirectionalLight, Group, HemisphereLight } from 'three';

export class StudioLightingRig extends Group {
  public constructor() {
    super();
    this.name = 'home-configurator.lighting';

    const ambient = new AmbientLight(0xffffff, 0.55);
    const hemisphere = new HemisphereLight(0xd8d4cc, 0x171513, 1.1);
    const key = new DirectionalLight(0xfff4e6, 3.2);
    const fill = new DirectionalLight(0xc8d4ff, 1.1);

    key.position.set(4, 5, 5);
    fill.position.set(-4, 1.5, 2);
    key.castShadow = true;

    this.add(ambient, hemisphere, key, fill);
  }
}
