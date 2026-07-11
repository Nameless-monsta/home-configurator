import type { Diagnostics } from '@home-configurator/runtime';

import type { NavigationLocation } from './types.js';

export type NavigationListener = (location: NavigationLocation, previous: NavigationLocation) => void;

export class NavigationEngine {
  readonly #diagnostics: Diagnostics;
  readonly #listeners = new Set<NavigationListener>();
  readonly #history: NavigationLocation[] = [];
  #location: NavigationLocation = { level: 'home' };
  #locked = false;

  public constructor(diagnostics: Diagnostics) {
    this.#diagnostics = diagnostics;
  }

  public get location(): NavigationLocation {
    return { ...this.#location };
  }

  public get locked(): boolean {
    return this.#locked;
  }

  public setLocked(locked: boolean): void {
    this.#locked = locked;
    this.#diagnostics.setGauge('interaction.navigationLocked', locked ? 1 : 0);
  }

  public navigate(next: NavigationLocation, replace = false): boolean {
    if (this.#locked) {
      this.#diagnostics.increment('interaction.navigationRejected');
      return false;
    }
    this.#validate(next);
    const previous = this.#location;
    if (!replace) this.#history.push(previous);
    this.#location = { ...next };
    this.#diagnostics.record('info', 'interaction.navigation', 'Navigation changed', {
      from: previous.level,
      to: next.level,
    });
    for (const listener of [...this.#listeners]) listener(this.location, previous);
    return true;
  }

  public back(): boolean {
    if (this.#locked) return false;
    const previous = this.#history.pop();
    if (!previous) return false;
    const current = this.#location;
    this.#location = previous;
    for (const listener of [...this.#listeners]) listener(this.location, current);
    return true;
  }

  public subscribe(listener: NavigationListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  public clear(): void {
    this.#history.length = 0;
    this.#location = { level: 'home' };
    this.#locked = false;
  }

  #validate(location: NavigationLocation): void {
    if ((location.level === 'room' || location.level === 'device' || location.level === 'control') && !location.roomId) {
      throw new Error(`Navigation level ${location.level} requires roomId`);
    }
    if ((location.level === 'device' || location.level === 'control') && !location.deviceId) {
      throw new Error(`Navigation level ${location.level} requires deviceId`);
    }
    if (location.level === 'control' && !location.controlId) {
      throw new Error('Navigation level control requires controlId');
    }
  }
}
