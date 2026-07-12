import { DeviceStore } from '@home-configurator/runtime';
import { Group, Mesh, MeshPhysicalMaterial, PointLight, SphereGeometry } from 'three';
import { describe, expect, it } from 'vitest';

import { SelectedDeviceLightBinding } from '../src/index.js';

const modelFixture = () => {
  const model = new Group();
  const material = new MeshPhysicalMaterial({ emissive: 0xffc987, emissiveIntensity: 1 });
  const bulb = new Mesh(new SphereGeometry(1), material);
  const glow = new PointLight(0xffffff, 1);
  model.add(bulb, glow);
  return { bulb, glow, material, model };
};

const storeFixture = () => {
  const store = new DeviceStore();
  store.upsert({
    descriptor: {
      id: 'light-1',
      roomId: 'living',
      entityIds: ['light.lamp'],
      available: true,
      connected: true,
    },
    confirmedState: { power: true, brightness: 0.5, color: [120, 100] },
  });
  return store;
};

describe('SelectedDeviceLightBinding', () => {
  it('binds selected light power, brightness and colour to the model', () => {
    const store = storeFixture();
    const { glow, material, model } = modelFixture();
    const binding = new SelectedDeviceLightBinding({ store, model });

    binding.setSelectedDevice('light-1');

    expect(model.userData['deviceId']).toBe('light-1');
    expect(glow.intensity).toBeGreaterThan(1);
    expect(material.emissiveIntensity).toBeGreaterThan(0);
    expect(material.color.g).toBeGreaterThan(material.color.r);
    expect(store.get('light-1')?.snapshot().selected).toBe(true);

    binding.dispose();
    store.dispose();
  });

  it('shows pending state and reacts to authoritative updates', () => {
    const store = storeFixture();
    const { glow, model } = modelFixture();
    const binding = new SelectedDeviceLightBinding({ store, model });
    binding.setSelectedDevice('light-1');

    store.applyOptimistic('light-1', { brightness: 1 }, { commandId: 'cmd-1', issuedAt: 1 });
    expect(model.userData['pending']).toBe(true);
    const pendingIntensity = glow.intensity;

    store.confirm(
      'light-1',
      { power: false, brightness: 0, color: [120, 100] },
      { commandId: 'cmd-1' },
    );
    expect(model.userData['pending']).toBe(false);
    expect(glow.intensity).toBe(0);
    expect(pendingIntensity).toBeGreaterThan(0);

    binding.dispose();
    store.dispose();
  });

  it('desaturates an unavailable selected device', () => {
    const store = storeFixture();
    const { material, model } = modelFixture();
    const binding = new SelectedDeviceLightBinding({ store, model });
    binding.setSelectedDevice('light-1');

    store.setAvailability('light-1', false, { connected: false });

    expect(model.userData['available']).toBe(false);
    expect(material.opacity).toBeLessThan(1);

    binding.dispose();
    store.dispose();
  });
});
