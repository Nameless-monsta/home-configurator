import { describe, expect, it, vi } from 'vitest';

import { UiMotionController, iyoMotionTokens } from '../src/motion.js';

const animation = () => {
  const listeners = new Map<string, () => void>();
  return {
    cancel: vi.fn(() => listeners.get('cancel')?.()),
    addEventListener: vi.fn((name: string, listener: () => void) => listeners.set(name, listener)),
  };
};

const animatedElement = () => {
  const instance = animation();
  return {
    instance,
    element: {
      animate: vi.fn(() => instance),
    } as unknown as Element,
  };
};

describe('UiMotionController', () => {
  it('exposes the shared iyO motion tokens', () => {
    expect(iyoMotionTokens.duration.standard).toBe(260);
    expect(iyoMotionTokens.easing.enter).toContain('cubic-bezier');
    expect(iyoMotionTokens.distance.pronounced).toBeGreaterThan(iyoMotionTokens.distance.subtle);
  });

  it('uses shared duration and easing when animating', () => {
    const { element } = animatedElement();
    const controller = new UiMotionController({ reducedMotion: () => false });

    controller.reveal(element);

    expect(element.animate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        duration: iyoMotionTokens.duration.fast,
        easing: iyoMotionTokens.easing.enter,
        fill: 'both',
      }),
    );
  });

  it('cancels superseded motion on the same element', () => {
    const { element, instance } = animatedElement();
    const controller = new UiMotionController({ reducedMotion: () => false });

    controller.reveal(element);
    controller.press(element);

    expect(instance.cancel).toHaveBeenCalledOnce();
    expect(element.animate).toHaveBeenCalledTimes(2);
  });

  it('uses distinct panel entrance and exit choreography', () => {
    const entrance = animatedElement();
    const exit = animatedElement();
    const controller = new UiMotionController({ reducedMotion: () => false });

    controller.enterPanel(entrance.element);
    controller.exitPanel(exit.element);

    expect(entrance.element.animate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ opacity: 0 }), expect.objectContaining({ opacity: 1 })]),
      expect.objectContaining({ duration: iyoMotionTokens.duration.standard }),
    );
    expect(exit.element.animate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ opacity: 1 }), expect.objectContaining({ opacity: 0 })]),
      expect.objectContaining({ duration: iyoMotionTokens.duration.fast }),
    );
  });

  it('skips animation when reduced motion is requested', () => {
    const { element } = animatedElement();
    const controller = new UiMotionController({ reducedMotion: () => true });

    expect(controller.reveal(element)).toBeNull();
    expect(element.animate).not.toHaveBeenCalled();
  });
});
