import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  GeographicTimelineEvent,
} from './geographic-timeline-activities';

export const GEOGRAPHIC_PLAYBACK_SPEEDS = [
  0.5,
  1,
  2,
  4,
] as const;

export type GeographicPlaybackSpeed =
  typeof GEOGRAPHIC_PLAYBACK_SPEEDS[number];

type UseGeographicTimelinePlaybackOptions = {
  caseId: string | null;
  events: GeographicTimelineEvent[];
  focusActivityId: string | null;
  onFocusActivityHandled(): void;
};

type GeographicTimelinePlayback = {
  activeEvent:
    GeographicTimelineEvent | null;
  currentEvent:
    GeographicTimelineEvent | null;
  currentIndex: number;
  events: GeographicTimelineEvent[];
  isPlaying: boolean;
  panelOpen: boolean;
  selectionRevision: number;
  speed: GeographicPlaybackSpeed;

  minimizePanel(): void;
  next(): void;
  openPanel(): void;
  pause(): void;
  play(): void;
  previous(): void;
  restart(): void;
  seek(index: number): void;
  setSpeed(
    speed: GeographicPlaybackSpeed,
  ): void;
};

const BASE_EVENT_DELAY_MS = 2400;

export function useGeographicTimelinePlayback({
  caseId,
  events,
  focusActivityId,
  onFocusActivityHandled,
}: UseGeographicTimelinePlaybackOptions):
  GeographicTimelinePlayback {
  const timerRef =
    useRef<number | null>(null);
  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0);
  const [
    isPlaying,
    setIsPlaying,
  ] = useState(false);
  const [
    panelOpen,
    setPanelOpen,
  ] = useState(false);
  const [
    playbackActive,
    setPlaybackActive,
  ] = useState(false);
  const [
    playbackCaseId,
    setPlaybackCaseId,
  ] = useState<string | null>(null);
  const [
    selectionRevision,
    setSelectionRevision,
  ] = useState(0);
  const [
    speed,
    setPlaybackSpeed,
  ] =
    useState<GeographicPlaybackSpeed>(1);

  const selectEvent = useCallback(
    (index: number): void => {
      if (events.length === 0) {
        return;
      }

      const boundedIndex = Math.min(
        Math.max(
          Math.trunc(index),
          0,
        ),
        events.length - 1,
      );

      setCurrentIndex(boundedIndex);
      setPlaybackActive(true);
      setPlaybackCaseId(caseId);
      setSelectionRevision(
        (current) => current + 1,
      );
    },
    [caseId, events.length],
  );

  const openPanel = useCallback(() => {
    setPanelOpen(true);

    if (
      events.length > 0 &&
      (
        !playbackActive ||
        playbackCaseId !== caseId
      )
    ) {
      selectEvent(currentIndex);
    }
  }, [
    caseId,
    currentIndex,
    events.length,
    playbackActive,
    playbackCaseId,
    selectEvent,
  ]);

  const minimizePanel =
    useCallback(() => {
      setPanelOpen(false);
    }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const stepEvent = useCallback(
    (direction: -1 | 1): void => {
      if (events.length === 0) {
        return;
      }

      setCurrentIndex(
        (current) =>
          Math.min(
            Math.max(
              current + direction,
              0,
            ),
            events.length - 1,
          ),
      );
      setPlaybackActive(true);
      setPlaybackCaseId(caseId);
      setSelectionRevision(
        (current) => current + 1,
      );
    },
    [caseId, events.length],
  );

  const play = useCallback(() => {
    setPanelOpen(true);

    if (events.length <= 1) {
      setIsPlaying(false);

      if (events.length === 1) {
        selectEvent(0);
      }

      return;
    }

    if (
      currentIndex >=
      events.length - 1
    ) {
      selectEvent(0);
    } else {
      selectEvent(currentIndex);
    }

    setIsPlaying(true);
  }, [
    currentIndex,
    events.length,
    selectEvent,
  ]);

  const previous = useCallback(() => {
    stepEvent(-1);
  }, [stepEvent]);

  const next = useCallback(() => {
    stepEvent(1);
  }, [stepEvent]);

  const restart = useCallback(() => {
    setIsPlaying(false);
    selectEvent(0);
  }, [selectEvent]);

  const seek = useCallback(
    (index: number): void => {
      selectEvent(index);
    },
    [selectEvent],
  );

  const setSpeed = useCallback(
    (
      nextSpeed:
        GeographicPlaybackSpeed,
    ): void => {
      setPlaybackSpeed(nextSpeed);
    },
    [],
  );

  useEffect(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
    setPlaybackActive(false);
    setPlaybackCaseId(null);
    setSelectionRevision(
      (current) => current + 1,
    );
  }, [caseId]);

  useEffect(() => {
    if (events.length === 0) {
      setIsPlaying(false);
      setCurrentIndex(0);
      setPlaybackActive(false);
      return;
    }

    setCurrentIndex(
      (current) =>
        Math.min(
          current,
          events.length - 1,
        ),
    );
  }, [events.length]);

  useEffect(() => {
    if (!focusActivityId) {
      return;
    }

    const eventIndex =
      events.findIndex(
        (event) =>
          event.activityId ===
          focusActivityId,
      );

    if (eventIndex >= 0) {
      setPanelOpen(true);
      setIsPlaying(false);
      selectEvent(eventIndex);
    }

    onFocusActivityHandled();
  }, [
    events,
    focusActivityId,
    onFocusActivityHandled,
    selectEvent,
  ]);

  useEffect(() => {
    if (
      !isPlaying ||
      events.length <= 1 ||
      playbackCaseId !== caseId
    ) {
      return undefined;
    }

    if (
      currentIndex >=
      events.length - 1
    ) {
      setIsPlaying(false);
      return undefined;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(
        timerRef.current,
      );
    }

    timerRef.current =
      window.setTimeout(() => {
        timerRef.current = null;
        selectEvent(
          currentIndex + 1,
        );
      }, BASE_EVENT_DELAY_MS / speed);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(
          timerRef.current,
        );
        timerRef.current = null;
      }
    };
  }, [
    currentIndex,
    caseId,
    events.length,
    isPlaying,
    playbackCaseId,
    selectEvent,
    speed,
  ]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(
          timerRef.current,
        );
      }
    },
    [],
  );

  const playbackMatchesCase =
    playbackCaseId === caseId;
  const displayedIndex =
    events.length === 0
      ? 0
      : playbackMatchesCase
        ? Math.min(
          currentIndex,
          events.length - 1,
        )
        : 0;
  const currentEvent =
    events[displayedIndex] ?? null;

  return {
    activeEvent:
      playbackActive
        && playbackMatchesCase
        ? currentEvent
        : null,
    currentEvent,
    currentIndex: displayedIndex,
    events,
    isPlaying:
      playbackMatchesCase &&
      isPlaying,
    panelOpen,
    selectionRevision,
    speed,
    minimizePanel,
    next,
    openPanel,
    pause,
    play,
    previous,
    restart,
    seek,
    setSpeed,
  };
}
