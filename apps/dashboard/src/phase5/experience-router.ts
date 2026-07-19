/**
 * Experience router — stable deep links and coherent browser back behaviour
 * for the persistent spatial shell. Routes map onto shell states rather than
 * page mounts: the scene never tears down, the URL simply names the current
 * spatial state. `#/` home · `#/room/{id}` · `#/alarm` · `#/settings` ·
 * `#/device/{id}` (device detail inside its room context).
 */

export type ExperienceRoute =
  | { readonly kind: 'home' }
  | { readonly kind: 'alarm' }
  | { readonly kind: 'settings' }
  | { readonly kind: 'room'; readonly roomId: string }
  | { readonly kind: 'device'; readonly deviceId: string };

/** Pure: parse a location hash into a route. Unknown hashes resolve to home. */
export const parseRoute = (hash: string): ExperienceRoute => {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (path === '' || path === 'home') return { kind: 'home' };
  if (path === 'alarm') return { kind: 'alarm' };
  if (path === 'settings') return { kind: 'settings' };
  const [head, ...rest] = path.split('/');
  const id = decodeURIComponent(rest.join('/'));
  if (head === 'room' && id) return { kind: 'room', roomId: id };
  if (head === 'device' && id) return { kind: 'device', deviceId: id };
  return { kind: 'home' };
};

/** Pure: format a route as a location hash. */
export const formatRoute = (route: ExperienceRoute): string => {
  switch (route.kind) {
    case 'home':
      return '#/';
    case 'alarm':
      return '#/alarm';
    case 'settings':
      return '#/settings';
    case 'room':
      return `#/room/${encodeURIComponent(route.roomId)}`;
    case 'device':
      return `#/device/${encodeURIComponent(route.deviceId)}`;
  }
};

export const routesEqual = (a: ExperienceRoute, b: ExperienceRoute): boolean =>
  formatRoute(a) === formatRoute(b);

export interface RouteHost {
  /** Drive the shell into the given route (external navigation: load / back). */
  applyRoute(route: ExperienceRoute): void;
}

/**
 * Two-way binding between location.hash and the shell. The shell reports its
 * state through `reflect`; browser navigation (back/forward, manual edits,
 * shared links) flows in through hashchange and the initial `start` call.
 */
export class ExperienceRouter {
  readonly #host: RouteHost;
  #suppress = false;
  #started = false;

  public constructor(host: RouteHost) {
    this.#host = host;
  }

  /** Apply the current URL once the shell has data, then follow hash changes. */
  public start(): void {
    if (this.#started) return;
    this.#started = true;
    window.addEventListener('hashchange', this.#onHashChange);
    this.#host.applyRoute(parseRoute(window.location.hash));
  }

  /** Shell → URL. Pushes a history entry so back retraces the spatial journey. */
  public reflect(route: ExperienceRoute): void {
    const next = formatRoute(route);
    if (window.location.hash === next || (window.location.hash === '' && next === '#/')) return;
    this.#suppress = true;
    window.location.hash = next;
  }

  public dispose(): void {
    window.removeEventListener('hashchange', this.#onHashChange);
    this.#started = false;
  }

  readonly #onHashChange = (): void => {
    if (this.#suppress) {
      this.#suppress = false;
      return;
    }
    this.#host.applyRoute(parseRoute(window.location.hash));
  };
}
