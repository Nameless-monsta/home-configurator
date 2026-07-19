/**
 * ExperienceData provider — the single read model bridging the confirmed Home
 * Assistant snapshot and the runtime device store (optimistic effective state)
 * into the view models the experience shell consumes. Favourites are derived
 * from a stable per-room capability heuristic so the experience works with any
 * real Home Assistant setup, not just demo devices. docs/PHASE-5-IYO-EXPERIENCE.
 */

import type { ConfirmedRuntimeSnapshot, CanonicalDevice } from '@home-configurator/home-assistant';

import type { ExperienceData } from './experience-shell.js';
import { deriveCategory, deriveState, type DeviceView, type RoomView } from './experience-model.js';
import type { AmbientSummary } from './experience-views.js';

export interface DeviceStateReader {
  get(deviceId: string): {
    snapshot(): {
      effectiveState?: Readonly<Record<string, unknown>>;
      available?: boolean;
      pendingCommandIds?: readonly string[];
    };
  } | null;
}

export interface ExperienceDataSourceOptions {
  snapshot: () => ConfirmedRuntimeSnapshot | null;
  store: DeviceStateReader;
  isFavourite?: (device: CanonicalDevice) => boolean;
}

const defaultFavourite = (device: CanonicalDevice): boolean =>
  device.capabilities.includes('brightness') ||
  device.capabilities.includes('targetTemperature') ||
  device.capabilities.includes('lock') ||
  device.capabilities.includes('mediaPlayback');

export class ExperienceDataSource implements ExperienceData {
  readonly #snapshot: () => ConfirmedRuntimeSnapshot | null;
  readonly #store: DeviceStateReader;
  readonly #isFavourite: (device: CanonicalDevice) => boolean;

  public constructor(options: ExperienceDataSourceOptions) {
    this.#snapshot = options.snapshot;
    this.#store = options.store;
    this.#isFavourite = options.isFavourite ?? defaultFavourite;
  }

  public rooms(): readonly RoomView[] {
    const snapshot = this.#snapshot();
    if (!snapshot) return [];
    return snapshot.rooms
      .map((room) => ({ id: room.id, name: room.name, deviceIds: room.deviceIds }))
      .filter((room) => room.deviceIds.length > 0);
  }

  public devices(): readonly DeviceView[] {
    const snapshot = this.#snapshot();
    if (!snapshot) return [];
    const roomName = new Map(snapshot.rooms.map((room) => [room.id, room.name] as const));
    return snapshot.devices.map((device) =>
      this.#toView(device, roomName.get(device.roomId) ?? 'Home'),
    );
  }

  public device(id: string): DeviceView | undefined {
    const snapshot = this.#snapshot();
    if (!snapshot) return undefined;
    const device = snapshot.devices.find((entry) => entry.id === id);
    if (!device) return undefined;
    const roomName = snapshot.rooms.find((room) => room.id === device.roomId)?.name ?? 'Home';
    return this.#toView(device, roomName);
  }

  public favourites(): readonly DeviceView[] {
    return this.devices()
      .filter((view) => view.favourite)
      .slice(0, 8);
  }

  public ambient(): AmbientSummary {
    const snapshot = this.#snapshot();
    const devices = this.devices();
    const climate = devices.find((view) => view.category === 'climate');
    const sensor = devices.find((view) => view.category === 'sensor');
    const locks = devices.filter((view) => view.capabilities.includes('lock'));
    const securedCount = locks.filter((view) => view.state.locked).length;
    const unavailable = devices
      .filter((view) => !view.state.available)
      .map((view) => `${view.name} offline`);

    const temp = climate?.state.currentTemp ?? sensor?.state.currentTemp ?? 22;
    const humidity = sensor?.state.humidity ?? climate?.state.humidity ?? 45;
    const security = locks.length
      ? securedCount === locks.length
        ? 'All doors locked'
        : `${locks.length - securedCount} unlocked`
      : 'No locks';

    const status = snapshot?.status ?? 'connecting';
    return {
      connected: status === 'ready' || status === 'degraded',
      greeting: greeting(),
      statusSentence: statusSentence(status, unavailable.length),
      comfort: `${temp.toFixed(1)}° · ${Math.round(humidity)}% humidity`,
      air: 'Air good',
      security,
      activeScene: null,
      alerts: unavailable,
    };
  }

  #toView(device: CanonicalDevice, roomName: string): DeviceView {
    const raw = this.#store.get(device.id)?.snapshot();
    const category = deriveCategory(device);
    return {
      id: device.id,
      name: device.name,
      roomId: device.roomId,
      roomName,
      category,
      capabilities: device.capabilities,
      favourite: this.#isFavourite(device),
      available: raw?.available ?? device.available,
      ...(device.manufacturer === undefined ? {} : { manufacturer: device.manufacturer }),
      ...(device.model === undefined ? {} : { model: device.model }),
      state: deriveState(device, raw),
    };
  }
}

const greeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const statusSentence = (status: string, offline: number): string => {
  if (status !== 'ready' && status !== 'degraded') return 'Connecting to your home…';
  if (offline > 0) return 'Your home needs a little attention.';
  return 'The house is settled.';
};
