"use client";

import AutoScroll from "embla-carousel-auto-scroll";
import { Pause, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AffiliateProductCard } from "@/components/affiliate-product-card";
import { Button } from "@/components/ui/button";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { AffiliateStorefrontProduct } from "@/lib/affiliate/types";
import type { Locale } from "@/lib/i18n";
import { PAGE_COPY } from "@/lib/i18n-pages";

const MANUAL_NAVIGATION_GRACE_MS = 2500;

export function AffiliateProductCarousel({
  products,
  locale,
  sectionId,
}: {
  products: AffiliateStorefrontProduct[];
  locale: Locale;
  sectionId: string;
}): ReactElement {
  const copy = PAGE_COPY[locale];
  const reduceMotion = useReducedMotion();
  const canAutoScroll = products.length >= 4 && !reduceMotion;
  const autoScroll = useMemo(
    () =>
      AutoScroll({
        direction: "backward",
        playOnInit: canAutoScroll,
        speed: 0.75,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    [canAutoScroll],
  );
  const [api, setApi] = useState<CarouselApi>();
  const [isPlaying, setIsPlaying] = useState(canAutoScroll);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const activeAutoScrollRef = useRef(autoScroll);
  const canAutoScrollRef = useRef(canAutoScroll);
  const manuallyPausedRef = useRef(isManuallyPaused);
  const focusWithinRef = useRef(false);
  const hoverWithinRef = useRef(false);
  const pointerNavigationRef = useRef(false);
  const pointerMovedRef = useRef(false);
  const pointerStartProgressRef = useRef(0);
  const pointerStartSnapRef = useRef(0);
  const pointerReleaseFrameRef = useRef<number | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lifecycleGenerationRef = useRef(0);
  const mountedRef = useRef(true);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current === null) return;
    clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  }, []);

  const cancelPointerReleaseFinalizer = useCallback(() => {
    if (pointerReleaseFrameRef.current === null) return;
    cancelAnimationFrame(pointerReleaseFrameRef.current);
    pointerReleaseFrameRef.current = null;
  }, []);

  const canResume = useCallback(
    () =>
      canAutoScrollRef.current &&
      !manuallyPausedRef.current &&
      !focusWithinRef.current &&
      !hoverWithinRef.current &&
      !pointerNavigationRef.current &&
      restartTimerRef.current === null &&
      document.visibilityState !== "hidden",
    [],
  );

  const stopAutoScroll = useCallback(() => {
    activeAutoScrollRef.current.stop();
  }, []);

  const reconcileAutoScroll = useCallback(
    (
      plugin = activeAutoScrollRef.current,
      generation = lifecycleGenerationRef.current,
    ) => {
      if (
        !mountedRef.current ||
        plugin !== activeAutoScrollRef.current ||
        generation !== lifecycleGenerationRef.current
      ) {
        return;
      }

      if (!canResume()) {
        plugin.stop();
        setIsPlaying(false);
        return;
      }

      if (!plugin.isPlaying()) plugin.play();
      setIsPlaying(plugin.isPlaying());
    },
    [canResume],
  );

  const resumeAutoScroll = useCallback(() => {
    reconcileAutoScroll();
  }, [reconcileAutoScroll]);

  const restartAfterManualNavigation = useCallback(() => {
    clearRestartTimer();
    stopAutoScroll();
    if (!canAutoScrollRef.current || manuallyPausedRef.current) return;

    const plugin = activeAutoScrollRef.current;
    const generation = lifecycleGenerationRef.current;
    restartTimerRef.current = setTimeout(() => {
      if (
        plugin !== activeAutoScrollRef.current ||
        generation !== lifecycleGenerationRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      restartTimerRef.current = null;
      reconcileAutoScroll(plugin, generation);
    }, MANUAL_NAVIGATION_GRACE_MS);
  }, [clearRestartTimer, reconcileAutoScroll, stopAutoScroll]);

  const handlePrevious = useCallback(() => {
    api?.scrollPrev();
    restartAfterManualNavigation();
  }, [api, restartAfterManualNavigation]);

  const handleNext = useCallback(() => {
    api?.scrollNext();
    restartAfterManualNavigation();
  }, [api, restartAfterManualNavigation]);

  const handlePlayPause = useCallback(() => {
    const nextManuallyPaused = !manuallyPausedRef.current;
    manuallyPausedRef.current = nextManuallyPaused;
    setIsManuallyPaused(nextManuallyPaused);

    if (nextManuallyPaused) {
      clearRestartTimer();
      stopAutoScroll();
      return;
    }

    resumeAutoScroll();
  }, [clearRestartTimer, resumeAutoScroll, stopAutoScroll]);

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (event.currentTarget.contains(event.target)) {
        focusWithinRef.current = true;
        stopAutoScroll();
      }
    },
    [stopAutoScroll],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      focusWithinRef.current = false;
      resumeAutoScroll();
    },
    [resumeAutoScroll],
  );

  const handleMouseEnter = useCallback(() => {
    hoverWithinRef.current = true;
    stopAutoScroll();
  }, [stopAutoScroll]);

  const handleMouseLeave = useCallback(() => {
    hoverWithinRef.current = false;
    resumeAutoScroll();
  }, [resumeAutoScroll]);

  const handleKeyDownCapture = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        restartAfterManualNavigation();
      }
    },
    [restartAfterManualNavigation],
  );

  useEffect(() => {
    if (!api) return;

    activeAutoScrollRef.current = autoScroll;
    canAutoScrollRef.current = canAutoScroll;
    const generation = lifecycleGenerationRef.current + 1;
    lifecycleGenerationRef.current = generation;
    clearRestartTimer();
    cancelPointerReleaseFinalizer();
    pointerNavigationRef.current = false;
    pointerMovedRef.current = false;

    const updatePlaying = (playing: boolean) => {
      if (
        mountedRef.current &&
        activeAutoScrollRef.current === autoScroll &&
        lifecycleGenerationRef.current === generation
      ) {
        setIsPlaying(playing);
      }
    };
    const handleAutoScrollPlay = () => {
      updatePlaying(canResume());
      queueMicrotask(() => reconcileAutoScroll(autoScroll, generation));
    };
    const handleAutoScrollStop = () => updatePlaying(false);
    const handleReInit = () => {
      cancelPointerReleaseFinalizer();
      pointerNavigationRef.current = false;
      pointerMovedRef.current = false;
      reconcileAutoScroll(autoScroll, generation);
    };
    const handlePointerDown = () => {
      cancelPointerReleaseFinalizer();
      pointerNavigationRef.current = true;
      pointerMovedRef.current = false;
      pointerStartProgressRef.current = api.scrollProgress();
      pointerStartSnapRef.current = api.selectedScrollSnap();
      clearRestartTimer();
      stopAutoScroll();
    };
    const handleScroll = () => {
      if (!pointerNavigationRef.current) return;
      pointerMovedRef.current = true;
      cancelPointerReleaseFinalizer();
    };
    const handlePointerUp = () => {
      if (!pointerNavigationRef.current) return;
      cancelPointerReleaseFinalizer();

      const firstFrame = requestAnimationFrame(() => {
        if (
          !mountedRef.current ||
          activeAutoScrollRef.current !== autoScroll ||
          lifecycleGenerationRef.current !== generation ||
          pointerReleaseFrameRef.current !== firstFrame
        ) {
          return;
        }

        const secondFrame = requestAnimationFrame(() => {
          if (pointerReleaseFrameRef.current !== secondFrame) return;
          pointerReleaseFrameRef.current = null;
          if (
            !mountedRef.current ||
            activeAutoScrollRef.current !== autoScroll ||
            lifecycleGenerationRef.current !== generation ||
            !pointerNavigationRef.current
          ) {
            return;
          }

          const moved =
            pointerMovedRef.current ||
            api.scrollProgress() !== pointerStartProgressRef.current ||
            api.selectedScrollSnap() !== pointerStartSnapRef.current;
          if (moved) return;

          pointerNavigationRef.current = false;
          reconcileAutoScroll(autoScroll, generation);
        });
        pointerReleaseFrameRef.current = secondFrame;
      });
      pointerReleaseFrameRef.current = firstFrame;
    };
    const handleSettle = () => {
      if (!pointerNavigationRef.current) return;
      cancelPointerReleaseFinalizer();
      pointerNavigationRef.current = false;
      pointerMovedRef.current = false;
      restartAfterManualNavigation();
    };

    api.on("autoScroll:play", handleAutoScrollPlay);
    api.on("autoScroll:stop", handleAutoScrollStop);
    api.on("reInit", handleReInit);
    api.on("pointerDown", handlePointerDown);
    api.on("scroll", handleScroll);
    api.on("pointerUp", handlePointerUp);
    api.on("settle", handleSettle);
    reconcileAutoScroll(autoScroll, generation);

    return () => {
      api.off("autoScroll:play", handleAutoScrollPlay);
      api.off("autoScroll:stop", handleAutoScrollStop);
      api.off("reInit", handleReInit);
      api.off("pointerDown", handlePointerDown);
      api.off("scroll", handleScroll);
      api.off("pointerUp", handlePointerUp);
      api.off("settle", handleSettle);
      if (lifecycleGenerationRef.current === generation) {
        lifecycleGenerationRef.current += 1;
      }
      clearRestartTimer();
      cancelPointerReleaseFinalizer();
      pointerNavigationRef.current = false;
      pointerMovedRef.current = false;
      autoScroll.stop();
    };
  }, [
    api,
    autoScroll,
    canAutoScroll,
    canResume,
    cancelPointerReleaseFinalizer,
    clearRestartTimer,
    reconcileAutoScroll,
    restartAfterManualNavigation,
    stopAutoScroll,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      reconcileAutoScroll();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleVisibilityChange();
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoScroll, canAutoScroll, reconcileAutoScroll]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      lifecycleGenerationRef.current += 1;
      clearRestartTimer();
      cancelPointerReleaseFinalizer();
    };
  }, [cancelPointerReleaseFinalizer, clearRestartTimer]);

  return (
    <Carousel
      id={`${sectionId}-carousel`}
      aria-label={copy.carouselLabel}
      opts={{ align: "start", loop: canAutoScroll, dragFree: true }}
      plugins={canAutoScroll ? [autoScroll] : []}
      setApi={setApi}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
      onKeyDownCapture={handleKeyDownCapture}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="mt-4"
    >
      <CarouselContent>
        {products.map((product) => (
          <CarouselItem
            key={product.id}
            className="basis-[88%] min-[480px]:basis-[72%] sm:basis-1/2 lg:basis-1/3"
          >
            <AffiliateProductCard product={product} locale={locale} />
          </CarouselItem>
        ))}
      </CarouselContent>

      <div className="mt-4 flex items-center gap-2">
        <CarouselPrevious
          aria-label={copy.previousProduct}
          className="static translate-y-0"
          onClick={handlePrevious}
        />
        <CarouselNext
          aria-label={copy.nextProduct}
          className="static translate-y-0"
          onClick={handleNext}
        />
        {canAutoScroll ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={
              isManuallyPaused ? copy.playCarousel : copy.pauseCarousel
            }
            aria-pressed={isManuallyPaused}
            data-autoplay-state={isPlaying ? "playing" : "stopped"}
            onClick={handlePlayPause}
            className="rounded-full"
          >
            {isManuallyPaused ? (
              <Play aria-hidden="true" />
            ) : (
              <Pause aria-hidden="true" />
            )}
          </Button>
        ) : null}
      </div>
    </Carousel>
  );
}
