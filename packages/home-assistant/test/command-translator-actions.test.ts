import { describe, expect, it } from 'vitest';

import { translateSemanticCommand, type CanonicalDevice } from '../src/index.js';

const shade: CanonicalDevice = {
  id: 'ha-device:shade',
  name: 'Terrace Shade',
  roomId: 'ha-area:terrace',
  entityIds: ['cover.terrace_shade'],
  bindings: [
    {
      entityId: 'cover.terrace_shade',
      domain: 'cover',
      capabilities: ['coverPosition'],
      available: true,
      stale: false,
    },
  ],
  capabilities: ['coverPosition'],
  available: true,
  optimistic: {},
};

describe('cover command translation', () => {
  it('translates the configurator stop action to stop_cover', () => {
    expect(
      translateSemanticCommand(shade, {
        id: 'cover-stop-1',
        deviceId: shade.id,
        capability: 'coverPosition',
        action: 'stop',
        issuedAt: 1,
        policy: 'reject-offline',
      }),
    ).toEqual({
      domain: 'cover',
      service: 'stop_cover',
      target: { entity_id: 'cover.terrace_shade' },
      data: {},
    });
  });
});
