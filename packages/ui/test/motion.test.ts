import { describe, expect, it, vi } from 'vitest';

import { UiMotionController, iyoMotionTokens } from '../src/motion.js';

const animatedElement = () => {
  const listeners = new Map<string, () => void>();
  const cancelSpy = vi.fn(() => listeners.get('cancel')?.());
  const instance = {
    cancel: cancelSpy,
    addEventListener: vi.fn((name: string, listener: () => void) => listeners.set(name, listener)),
  };
  const animateSpy = vi.fn(() => instance);
  return {
    animateSpy,
    cancelSpy,
    element: { animate: animateSpy } as unknown as Element,
  };
};

describe('UiMotionController', () => {
  it('exposes the shared iyO motion tokens', () => {
    expect(iyoMotionTokens.duration.standard).toBe(260);
    expect(iyoMotionTokens.easing.enter).toContain('cubic-bezier');
    expect(iyoMotionTokens.distance.pronounced).toBeGreaterThan(iyoMotionTokens.distance.subtle);
  });

  it('uses shared duration and easing when animating', () => {
    const { element, animateSpy } = animatedElement();
    const controller = new UiMotionController({ reducedMotion: () => false });

    controller.reveal(element);

    expect(animateSpy).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        duration: iyoMotionTokens.duration.fast,
        easing: iyoMotionTokens.easing.enter,
        fill: 'both',
      }),
    );
  });

  it('cancels superseded motion on the same element', () => {
    const { element, animateSpy, cancelSpy } = animatedElement();
    const controller = new UiMotionController({ reducedMotion: () => false });

    controller.reveal(element);
    controller.press(element);

    expect(cancelSpy).toHaveBeenCalledOnce();
    expect(animateSpy).toHaveBeenCalledTimes(2);
  });

  it('uses distinct panel entrance and exit choreography', () => {
    const entrance = animatedElement();
    const exit = animatedElement();
    const controller = new UiMotionController({ reducedMotion: () => false });

    controller.enterPanel(entrance.element);
    controller.exitPanel(exit.element);

    expect(entrance.animateSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ opacity: 0 }),
        expect.objectContaining({ opacity: 1 }),
      ]),
      expect.objectContaining({ duration: iyoMotionTokens.duration.standard }),
    );
    expect(exit.animateSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ opacity: 1 }),
        expect.objectContaining({ opacity: 0 }),
      ]),
      expect.objectContaining({ duration: iyoMotionTokens.duration.fast }),
    );
  });

  it('skips animation when reduced motion is requested', () => {
    const { element, animateSpy } = animatedElement();
    const controller = new UiMotionController({ reducedMotion: () => true });

    expect(controller.reveal(element)).toBeNull();
    expect(animateSpy).not.toHaveBeenCalled();
  });
});
