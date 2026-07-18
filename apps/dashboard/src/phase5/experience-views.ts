/**
 * Static section scaffolding for the experience shell. Carousels and shelves
 * are mounted imperatively into the hosts these renderers provide.
 * docs/PHASE-5-IYO-EXPERIENCE §5.1/5.2.
 */

import { categoryLabel, type DeviceCategory } from './experience-model.js';

export interface AmbientSummary {
  readonly greeting: string;
  readonly statusSentence: string;
  readonly comfort: string;
  readonly air: string;
  readonly security: string;
  readonly activeScene: string | null;
  readonly alerts: readonly string[];
}

export const renderHomeShell = (ambient: AmbientSummary): string => `
  <header class="p5-home-head">
    <p class="p5-label">${ambient.greeting}</p>
    <h1 class="p5-display">${ambient.statusSentence}</h1>
    <div class="p5-ambient">
      <span class="p5-ambient-chip">${ambient.comfort}</span>
      <span class="p5-ambient-chip">${ambient.air}</span>
      <span class="p5-ambient-chip">${ambient.security}</span>
      ${ambient.activeScene ? `<span class="p5-ambient-chip" data-scene="true">Scene · ${ambient.activeScene}</span>` : ''}
    </div>
    ${ambient.alerts.length ? `<p class="p5-home-alert" role="alert">${ambient.alerts.join(' · ')}</p>` : ''}
  </header>
  <section class="p5-home-favourites" aria-label="Favourite devices">
    <div class="p5-section-head"><p class="p5-label">Favourites</p></div>
    <div data-p5-favourite-carousel></div>
  </section>
  <section class="p5-home-rooms" aria-label="Rooms">
    <div class="p5-section-head"><p class="p5-label">Rooms</p></div>
    <div class="p5-room-rail" data-p5-room-rail></div>
  </section>
`;

export const renderRoomsShell = (): string => `
  <header class="p5-rooms-head">
    <p class="p5-label">Rooms</p>
    <h1 class="p5-display" data-p5-rooms-title>Choose a space.</h1>
  </header>
  <div data-p5-rooms-body></div>
`;

export const roomChip = (id: string, name: string, count: number): string => `
  <button class="p5-room-chip" data-p5-open-room="${id}">
    <strong>${name}</strong><span>${count} devices</span>
  </button>`;

export const shelfHeading = (category: DeviceCategory): string =>
  `<h2 class="p5-shelf-title">${categoryLabel(category)}</h2>`;
