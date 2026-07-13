"use client";

import AutoScroll from "embla-carousel-auto-scroll";
import { Pause, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import {
  type FocusEvent,
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
  const manuallyPausedRef = useRef(false);
  const focusWithinRef = useRef(false);
  const hoverWithinRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current === null) return;
    clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (!canAutoScroll) return;
    autoScroll.stop();
    setIsPlaying(false);
  }, [autoScroll, canAutoScroll]);

  const canResume = useCallback(
    () =>
      canAutoScroll &&
      !manuallyPausedRef.current &&
      !focusWithinRef.current &&
      !hoverWithinRef.current &&
      restartTimerRef.current === null &&
      document.visibilityState !== "hidden",
    [canAutoScroll],
  );

  const resumeAutoScroll = useCallback(() => {
    if (!canResume()) return;
    autoScroll.play();
    setIsPlaying(true);
  }, [autoScroll, canResume]);

  const restartAfterManualNavigation = useCallback(() => {
    if (!canAutoScroll || manuallyPausedRef.current) return;

    clearRestartTimer();
    stopAutoScroll();
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      resumeAutoScroll();
    }, MANUAL_NAVIGATION_GRACE_MS);
  }, [canAutoScroll, clearRestartTimer, resumeAutoScroll, stopAutoScroll]);

  const handlePrevious = useCallback(() => {
    api?.scrollPrev();
    restartAfterManualNavigation();
  }, [api, restartAfterManualNavigation]);

  const handleNext = useCallback(() => {
    api?.scrollNext();
    restartAfterManualNavigation();
  }, [api, restartAfterManualNavigation]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      manuallyPausedRef.current = true;
      clearRestartTimer();
      stopAutoScroll();
      return;
    }

    manuallyPausedRef.current = false;
    resumeAutoScroll();
  }, [clearRestartTimer, isPlaying, resumeAutoScroll, stopAutoScroll]);

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

  useEffect(() => {
    if (!api || !canAutoScroll) return;

    const syncPlayingState = () => setIsPlaying(autoScroll.isPlaying());
    api.on("autoScroll:play", syncPlayingState);
    api.on("autoScroll:stop", syncPlayingState);
    syncPlayingState();

    return () => {
      api.off("autoScroll:play", syncPlayingState);
      api.off("autoScroll:stop", syncPlayingState);
    };
  }, [api, autoScroll, canAutoScroll]);

  useEffect(() => {
    if (!canAutoScroll) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopAutoScroll();
      } else {
        resumeAutoScroll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [canAutoScroll, resumeAutoScroll, stopAutoScroll]);

  useEffect(() => clearRestartTimer, [clearRestartTimer]);

  return (
    <Carousel
      id={`${sectionId}-carousel`}
      aria-label={copy.carouselLabel}
      opts={{ align: "start", loop: canAutoScroll, dragFree: true }}
      plugins={canAutoScroll ? [autoScroll] : []}
      setApi={setApi}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
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
            aria-label={isPlaying ? copy.pauseCarousel : copy.playCarousel}
            aria-pressed={!isPlaying}
            onClick={handlePlayPause}
            className="rounded-full"
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>
        ) : null}
      </div>
    </Carousel>
  );
}
