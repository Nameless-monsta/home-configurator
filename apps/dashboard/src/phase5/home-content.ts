/**
 * Slide-up content beneath the hero. Home: favourites, live summary tiles,
 * rooms and the full device inventory. Room: room identity, environment,
 * quick lighting control and the room's device hierarchy. Alarm: security
 * overview. All values derive from the live DeviceView models; controls
 * dispatch through the shared command path via shell delegation attributes.
 */

import { categoryLabel, primaryStatus, type DeviceView } from './experience-model.js';
import type { RoomView } from './experience-model.js';
import type { AmbientSummary } from './experience-views.js';

export interface HomeSummary {
  readonly lightsOn: number;
  readonly lightsTotal: number;
  readonly averageTemp: number | null;
  readonly humidity: number | null;
  readonly locked: number;
  readonly locksTotal: number;
  readonly coversOpen: number;
  readonly coversTotal: number;
  readonly mediaPlaying: number;
  readonly cleaning: number;
  readonly offline: readonly string[];
}

/** Pure summary derivation over a set of device views. */
export const deriveSummary = (views: readonly DeviceView[]): HomeSummary => {
  const lights = views.filter((view) => view.category === 'light');
  const climates = views.filter(
    (view) => view.category === 'climate' || view.category === 'sensor',
  );
  const locks = views.filter((view) => view.capabilities.includes('lock'));
  const covers = views.filter((view) => view.category === 'cover');
  const temps = climates
    .map((view) => view.state.currentTemp)
    .filter((value) => Number.isFinite(value));
  const humidities = climates
    .map((view) => view.state.humidity)
    .filter((value) => Number.isFinite(value) && value > 0);
  return {
    lightsOn: lights.filter((view) => view.state.on).length,
    lightsTotal: lights.length,
    averageTemp: temps.length
      ? temps.reduce((total, value) => total + value, 0) / temps.length
      : null,
    humidity: humidities.length
      ? humidities.reduce((total, value) => total + value, 0) / humidities.length
      : null,
    locked: locks.filter((view) => view.state.locked).length,
    locksTotal: locks.length,
    coversOpen: covers.filter((view) => view.state.position > 1).length,
    coversTotal: covers.length,
    mediaPlaying: views.filter((view) => view.category === 'media' && view.state.playing).length,
    cleaning: views.filter((view) => view.category === 'cleaning' && view.state.cleaning).length,
    offline: views.filter((view) => !view.state.available).map((view) => view.name),
  };
};

export interface SummaryTile {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly jumpDeviceId: string | null;
}

/** Pure: summary tiles with a jump target into the matching device. */
export const buildSummaryTiles = (
  views: readonly DeviceView[],
  summary: HomeSummary,
): readonly SummaryTile[] => {
  const first = (predicate: (view: DeviceView) => boolean): string | null =>
    views.find(predicate)?.id ?? null;
  const tiles: SummaryTile[] = [];
  if (summary.lightsTotal > 0) {
    tiles.push({
      id: 'lights',
      label: 'Lights',
      value: summary.lightsOn === 0 ? 'All off' : `${summary.lightsOn} on`,
      detail: `${summary.lightsTotal} fixtures`,
      jumpDeviceId: first((view) => view.category === 'light'),
    });
  }
  if (summary.averageTemp !== null) {
    tiles.push({
      id: 'climate',
      label: 'Climate',
      value: `${summary.averageTemp.toFixed(1)}°`,
      detail: summary.humidity !== null ? `${Math.round(summary.humidity)}% humidity` : 'Ambient',
      jumpDeviceId:
        first((view) => view.category === 'climate') ?? first((v) => v.category === 'sensor'),
    });
  }
  if (summary.locksTotal > 0) {
    tiles.push({
      id: 'security',
      label: 'Security',
      value:
        summary.locked === summary.locksTotal
          ? 'Secured'
          : `${summary.locksTotal - summary.locked} open`,
      detail: `${summary.locked}/${summary.locksTotal} locked`,
      jumpDeviceId: first((view) => view.capabilities.includes('lock')),
    });
  }
  if (summary.coversTotal > 0) {
    tiles.push({
      id: 'covers',
      label: 'Covers',
      value: summary.coversOpen === 0 ? 'Closed' : `${summary.coversOpen} open`,
      detail: `${summary.coversTotal} covers`,
      jumpDeviceId: first((view) => view.category === 'cover'),
    });
  }
  if (views.some((view) => view.category === 'media')) {
    tiles.push({
      id: 'media',
      label: 'Media',
      value: summary.mediaPlaying > 0 ? 'Playing' : 'Idle',
      detail: `${views.filter((view) => view.category === 'media').length} players`,
      jumpDeviceId: first((view) => view.category === 'media'),
    });
  }
  if (views.some((view) => view.category === 'cleaning')) {
    tiles.push({
      id: 'cleaning',
      label: 'Cleaning',
      value: summary.cleaning > 0 ? 'Cleaning' : 'Docked',
      detail: `${views.filter((view) => view.category === 'cleaning').length} robots`,
      jumpDeviceId: first((view) => view.category === 'cleaning'),
    });
  }
  return tiles;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const deviceRow = (view: DeviceView): string => `
  <button class="p5-device-row" type="button" data-p5-open="${escapeHtml(view.id)}" aria-label="Open ${escapeHtml(view.name)}">
    <span class="p5-device-glyph" data-category="${escapeHtml(view.category)}" aria-hidden="true"></span>
    <span class="p5-device-row-copy"><strong>${escapeHtml(view.name)}</strong><small>${escapeHtml(categoryLabel(view.category))}</small></span>
    <span class="p5-device-status" data-p5-status="${escapeHtml(view.id)}">${escapeHtml(primaryStatus(view))}</span>
    <span class="p5-device-chevron" aria-hidden="true">›</span>
  </button>`;

const deviceGrid = (views: readonly DeviceView[], emptyCopy: string): string =>
  views.length
    ? `<div class="p5-device-grid">${views.map(deviceRow).join('')}</div>`
    : `<p class="p5-empty">${escapeHtml(emptyCopy)}</p>`;

const tileMarkup = (tile: SummaryTile): string => `
  <button class="p5-tile" type="button" ${tile.jumpDeviceId ? `data-p5-jump="${escapeHtml(tile.jumpDeviceId)}"` : 'disabled'}>
    <small>${escapeHtml(tile.label)}</small>
    <strong data-p5-tile-value="${escapeHtml(tile.id)}">${escapeHtml(tile.value)}</strong>
    <span data-p5-tile-detail="${escapeHtml(tile.id)}">${escapeHtml(tile.detail)}</span>
  </button>`;

export const renderHomeContent = (
  ambient: AmbientSummary,
  favourites: readonly DeviceView[],
  views: readonly DeviceView[],
  rooms: readonly RoomView[],
): string => {
  const summary = deriveSummary(views);
  const tiles = buildSummaryTiles(views, summary);
  return `
    <div class="p5-content-grip" aria-hidden="true"></div>
    <header class="p5-section p5-home-head">
      <p class="p5-section-label">${escapeHtml(ambient.greeting)}</p>
      <h2 class="p5-home-sentence" data-p5-home-sentence>${escapeHtml(ambient.statusSentence)}</h2>
      <p class="p5-home-meta" data-p5-home-meta>${escapeHtml(`${ambient.comfort} · ${ambient.security}`)}</p>
    </header>
    ${
      summary.offline.length
        ? `<p class="p5-home-alert" role="alert">${escapeHtml(summary.offline.join(', '))} offline</p>`
        : ''
    }
    ${
      favourites.length
        ? `<section class="p5-section" aria-label="Favourite devices">
            <p class="p5-section-label">Favourites</p>
            <div class="p5-fav-strip">
              ${favourites
                .map(
                  (
                    view,
                  ) => `<button class="p5-fav" type="button" data-p5-jump="${escapeHtml(view.id)}">
                    <strong>${escapeHtml(view.name)}</strong>
                    <span data-p5-fav-status="${escapeHtml(view.id)}">${escapeHtml(primaryStatus(view))}</span>
                  </button>`,
                )
                .join('')}
            </div>
          </section>`
        : ''
    }
    ${
      tiles.length
        ? `<section class="p5-section" aria-label="Home summary">
            <p class="p5-section-label">At a glance</p>
            <div class="p5-tile-grid">${tiles.map(tileMarkup).join('')}</div>
          </section>`
        : ''
    }
    ${
      rooms.length
        ? `<section class="p5-section" aria-label="Rooms">
            <p class="p5-section-label">Rooms</p>
            <div class="p5-room-grid">
              ${rooms
                .map(
                  (
                    room,
                  ) => `<button class="p5-room-card" type="button" data-p5-nav-room="${escapeHtml(room.id)}">
                    <strong>${escapeHtml(room.name)}</strong>
                    <span>${room.deviceIds.length} devices</span>
                  </button>`,
                )
                .join('')}
            </div>
          </section>`
        : ''
    }
    <section class="p5-section p5-inventory" aria-label="All devices">
      <div class="p5-inventory-head"><p>All devices</p><span>${views.length}</span></div>
      ${deviceGrid(views, 'No devices discovered yet. Devices appear here as Home Assistant finds them.')}
    </section>
  `;
};

export const renderRoomContent = (room: RoomView, views: readonly DeviceView[]): string => {
  const summary = deriveSummary(views);
  const tiles = buildSummaryTiles(views, summary);
  const lights = views.filter((view) => view.category === 'light');
  const env = [
    summary.averageTemp !== null ? `${summary.averageTemp.toFixed(1)}°` : null,
    summary.humidity !== null ? `${Math.round(summary.humidity)}% humidity` : null,
    summary.locksTotal > 0
      ? summary.locked === summary.locksTotal
        ? 'Secured'
        : 'Unlocked'
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return `
    <div class="p5-content-grip" aria-hidden="true"></div>
    <section class="p5-section p5-room-identity" aria-label="${escapeHtml(room.name)} overview">
      <p class="p5-section-label">Room</p>
      <h2>${escapeHtml(room.name)}</h2>
      <p class="p5-room-env" data-p5-room-env>${escapeHtml(env || 'No environment data')}</p>
      ${
        lights.length
          ? `<div class="p5-quick-row" role="group" aria-label="Quick lighting">
              <button type="button" class="p5-quick" data-p5-quick="lights-on">All lights on</button>
              <button type="button" class="p5-quick" data-p5-quick="lights-off">All lights off</button>
            </div>`
          : ''
      }
    </section>
    ${
      tiles.length
        ? `<section class="p5-section" aria-label="Room summary">
            <p class="p5-section-label">At a glance</p>
            <div class="p5-tile-grid">${tiles.map(tileMarkup).join('')}</div>
          </section>`
        : ''
    }
    <section class="p5-section p5-inventory" aria-label="Devices in ${escapeHtml(room.name)}">
      <div class="p5-inventory-head"><p>Devices</p><span>${views.length}</span></div>
      ${deviceGrid(views, 'This room has no devices yet.')}
    </section>
  `;
};

export const renderAlarmContent = (views: readonly DeviceView[]): string => {
  const summary = deriveSummary(views);
  const secured = summary.locksTotal > 0 && summary.locked === summary.locksTotal;
  return `
    <div class="p5-content-grip" aria-hidden="true"></div>
    <section class="p5-section p5-room-identity" aria-label="Security overview">
      <p class="p5-section-label">Alarm</p>
      <h2>${secured ? 'Home secured' : summary.locksTotal > 0 ? 'Attention needed' : 'Security'}</h2>
      <p class="p5-room-env" data-p5-room-env>${
        summary.locksTotal > 0
          ? `${summary.locked} of ${summary.locksTotal} locks secured`
          : 'No security devices discovered'
      }</p>
    </section>
    <section class="p5-section p5-inventory" aria-label="Security devices">
      <div class="p5-inventory-head"><p>Security devices</p><span>${views.length}</span></div>
      ${deviceGrid(views, 'No locks, cameras or alarms discovered.')}
    </section>
  `;
};
