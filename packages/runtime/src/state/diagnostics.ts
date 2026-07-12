import type { DeviceStoreSnapshot, RuntimeStateDiagnostics } from './types.js';

export const summarizeRuntimeState = (snapshot: DeviceStoreSnapshot): RuntimeStateDiagnostics => {
  let availableCount = 0;
  let connectedCount = 0;
  let selectedCount = 0;
  let optimisticCount = 0;
  let rollbackCount = 0;
  let transitionCount = 0;
  let latencyTotal = 0;
  let latencySamples = 0;

  for (const device of snapshot.devices) {
    if (device.available) availableCount += 1;
    if (device.connected) connectedCount += 1;
    if (device.selected) selectedCount += 1;
    if (device.optimisticState !== null) optimisticCount += 1;
    rollbackCount += device.metrics.rollbacks;
    transitionCount += device.history.length;
    if (device.metrics.averageLatencyMs !== undefined) {
      latencyTotal += device.metrics.averageLatencyMs;
      latencySamples += 1;
    }
  }

  return {
    deviceCount: snapshot.devices.length,
    availableCount,
    connectedCount,
    selectedCount,
    optimisticCount,
    rollbackCount,
    transitionCount,
    ...(latencySamples === 0 ? {} : { averageLatencyMs: latencyTotal / latencySamples }),
  };
};
