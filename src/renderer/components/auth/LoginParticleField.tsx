import {
  useEffect,
  useRef,
} from 'react';

type Particle = {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
  size: number;
};

function createParticle(
  width: number,
  height: number,
  startAbove = false,
): Particle {
  return {
    x: Math.random() * width,
    y: startAbove
      ? -Math.random() * height * 0.25
      : Math.random() * height,
    speed: 680 + Math.random() * 920,
    length: 5 + Math.random() * 18,
    opacity: 0.28 + Math.random() * 0.68,
    size: 0.65 + Math.random() * 1.25,
  };
}

export function LoginParticleField() {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext('2d', {
        alpha: false,
      });

    if (!context) {
      return;
    }

    let width = 0;
    let height = 0;
    let frameId = 0;
    let previousTime =
      performance.now();
    let particles: Particle[] = [];
    const motionPreference =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      );
    let reducedMotion =
      motionPreference.matches;

    function paint(
      elapsedSeconds: number,
    ): void {
      context.globalAlpha = 1;
      context.fillStyle = '#000000';
      context.fillRect(
        0,
        0,
        width,
        height,
      );

      for (const particle of particles) {
        if (!reducedMotion) {
          particle.y +=
            particle.speed * elapsedSeconds;
        }

        if (
          particle.y - particle.length >
          height
        ) {
          Object.assign(
            particle,
            createParticle(
              width,
              height,
              true,
            ),
          );
        }

        context.globalAlpha =
          particle.opacity * 0.34;
        context.fillStyle = '#ffffff';
        context.fillRect(
          particle.x,
          particle.y - particle.length,
          particle.size,
          particle.length,
        );

        context.globalAlpha =
          particle.opacity;
        context.fillRect(
          particle.x,
          particle.y,
          particle.size,
          particle.size * 1.6,
        );
      }

      context.globalAlpha = 1;
    }

    function animate(
      currentTime: number,
    ): void {
      frameId = 0;

      const elapsedSeconds =
        Math.min(
          0.04,
          (currentTime - previousTime) /
            1_000,
        );

      previousTime = currentTime;
      paint(elapsedSeconds);

      if (
        !document.hidden &&
        !reducedMotion
      ) {
        frameId =
          window.requestAnimationFrame(
            animate,
          );
      }
    }

    function startAnimation(): void {
      if (
        frameId !== 0 ||
        document.hidden ||
        reducedMotion
      ) {
        return;
      }

      previousTime = performance.now();
      frameId =
        window.requestAnimationFrame(
          animate,
        );
    }

    function resize(): void {
      width = window.innerWidth;
      height = window.innerHeight;

      const pixelRatio =
        Math.min(
          window.devicePixelRatio || 1,
          1.5,
        );

      canvas.width = Math.round(
        width * pixelRatio,
      );
      canvas.height = Math.round(
        height * pixelRatio,
      );
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0,
      );

      const particleCount =
        Math.max(
          80,
          Math.min(
            220,
            Math.round(
              (width * height) / 11_000,
            ),
          ),
        );

      particles = Array.from(
        { length: particleCount },
        () =>
          createParticle(
            width,
            height,
          ),
      );

      paint(0);
    }

    function handleMotionPreference(
      event: MediaQueryListEvent,
    ): void {
      reducedMotion = event.matches;
      canvas.dataset.motion =
        reducedMotion
          ? 'reduced'
          : 'full';

      if (
        reducedMotion &&
        frameId !== 0
      ) {
        window.cancelAnimationFrame(
          frameId,
        );
        frameId = 0;
        paint(0);
        return;
      }

      startAnimation();
    }

    function handleVisibilityChange(): void {
      if (document.hidden) {
        if (frameId !== 0) {
          window.cancelAnimationFrame(
            frameId,
          );
          frameId = 0;
        }

        return;
      }

      startAnimation();
    }

    resize();
    canvas.dataset.motion =
      reducedMotion
        ? 'reduced'
        : 'full';
    startAnimation();

    window.addEventListener(
      'resize',
      resize,
      { passive: true },
    );
    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );
    motionPreference.addEventListener(
      'change',
      handleMotionPreference,
    );
    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(
          frameId,
        );
      }

      window.removeEventListener(
        'resize',
        resize,
      );
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
      motionPreference.removeEventListener(
        'change',
        handleMotionPreference,
      );
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="authLoginParticles"
      aria-hidden="true"
    />
  );
}
