import type {
  UiNavigationDevice,
  UiNavigationLocation,
  UiNavigationMenu,
  UiNavigationRoom,
  UiNavigationSnapshot,
} from './navigation-types.js';

const sameLocation = (left: UiNavigationLocation, right: UiNavigationLocation): boolean =>
  left.roomId === right.roomId && left.deviceId === right.deviceId;

export class UiNavigationModel {
  #rooms: readonly UiNavigationRoom[] = [];
  #devices: readonly UiNavigationDevice[] = [];
  #location: UiNavigationLocation = { roomId: null, deviceId: null };
  #menu: UiNavigationMenu = null;
  #history: UiNavigationLocation[] = [];
  #historyIndex = -1;
  readonly #listeners = new Set<(snapshot: UiNavigationSnapshot) => void>();

  public constructor(
    rooms: readonly UiNavigationRoom[] = [],
    devices: readonly UiNavigationDevice[] = [],
  ) {
    this.setItems(rooms, devices, false);
  }

  public snapshot(): UiNavigationSnapshot {
    return {
      ...this.#location,
      rooms: this.#rooms,
      devices: this.#devices,
      menu: this.#menu,
      canGoBack: this.#historyIndex > 0,
      canGoForward: this.#historyIndex >= 0 && this.#historyIndex < this.#history.length - 1,
    };
  }

  public subscribe(listener: (snapshot: UiNavigationSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.snapshot());
    return () => this.#listeners.delete(listener);
  }

  public setItems(
    rooms: readonly UiNavigationRoom[],
    devices: readonly UiNavigationDevice[],
    publish = true,
  ): void {
    this.#rooms = [...rooms];
    this.#devices = [...devices];

    const fallbackRoom = this.#rooms[0]?.id ?? null;
    const roomId = this.#rooms.some((room) => room.id === this.#location.roomId)
      ? this.#location.roomId
      : fallbackRoom;
    const roomDevices = this.#devices.filter((device) => device.roomId === roomId);
    const deviceId = roomDevices.some((device) => device.id === this.#location.deviceId)
      ? this.#location.deviceId
      : (roomDevices[0]?.id ?? null);

    this.#replaceLocation({ roomId, deviceId });
    if (this.#history.length === 0) this.#pushHistory(this.#location);
    if (publish) this.#publish();
  }

  public selectRoom(roomId: string): void {
    if (!this.#rooms.some((room) => room.id === roomId)) return;
    const deviceId = this.#devices.find((device) => device.roomId === roomId)?.id ?? null;
    this.#navigate({ roomId, deviceId });
  }

  public selectDevice(deviceId: string): void {
    const device = this.#devices.find((candidate) => candidate.id === deviceId);
    if (!device) return;
    this.#navigate({ roomId: device.roomId, deviceId: device.id });
  }

  public toggleMenu(menu: Exclude<UiNavigationMenu, null>): void {
    this.#menu = this.#menu === menu ? null : menu;
    this.#publish();
  }

  public closeMenu(): void {
    if (this.#menu === null) return;
    this.#menu = null;
    this.#publish();
  }

  public back(): void {
    if (this.#historyIndex <= 0) return;
    this.#historyIndex -= 1;
    this.#replaceLocation(this.#history[this.#historyIndex] ?? this.#location);
    this.#menu = null;
    this.#publish();
  }

  public forward(): void {
    if (this.#historyIndex >= this.#history.length - 1) return;
    this.#historyIndex += 1;
    this.#replaceLocation(this.#history[this.#historyIndex] ?? this.#location);
    this.#menu = null;
    this.#publish();
  }

  #navigate(location: UiNavigationLocation): void {
    if (sameLocation(location, this.#location)) {
      this.#menu = null;
      this.#publish();
      return;
    }
    this.#replaceLocation(location);
    this.#history = this.#history.slice(0, this.#historyIndex + 1);
    this.#pushHistory(location);
    this.#menu = null;
    this.#publish();
  }

  #replaceLocation(location: UiNavigationLocation): void {
    this.#location = location;
  }

  #pushHistory(location: UiNavigationLocation): void {
    this.#history.push({ ...location });
    this.#historyIndex = this.#history.length - 1;
  }

  #publish(): void {
    const snapshot = this.snapshot();
    for (const listener of this.#listeners) listener(snapshot);
  }
}
