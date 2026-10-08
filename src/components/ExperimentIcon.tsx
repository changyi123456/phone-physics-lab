import {
  Activity,
  AudioLines,
  Camera,
  ChartNoAxesColumn,
  Clock,
  Gauge,
  Magnet,
  MapPin,
  Orbit,
  Palette,
  RotateCw,
  SlidersHorizontal,
  Sun,
  Timer,
  Triangle,
  Vibrate,
} from "lucide-react";
import type { ExperimentId } from "../core/types";

export function ExperimentIcon({
  id,
  size = 22,
}: {
  id: ExperimentId;
  size?: number;
}) {
  if (
    id === "pendulum" ||
    id === "spring" ||
    id === "springK" ||
    id === "acceleration"
  ) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {id === "pendulum" ? (
          <>
            <path d="M13 3 5.6 16.5M13 3l5.8 15.4" />
            <circle cx="5" cy="19" r="2.6" />
            <circle cx="20" cy="20" r="1.6" />
          </>
        ) : id === "acceleration" ? (
          <>
            <circle cx="16.8" cy="3.7" r="1.7" />
            <path d="m12.9 7 3.4 1.7 2.8-1.3M12.9 7 9 10.4l4.1 3.2-3.4 7M13.1 13.6l4.1 2.9-2.8 4.2M4 8h4M2.5 12h4M5 19h3" />
          </>
        ) : (
          <path d="M14 2 7 5l10 3-10 3 10 3-10 3 10 3-7 2" />
        )}
      </svg>
    );
  }
  const Icon =
    (
      {
        gyroscope: RotateCw,
        inclination: Triangle,
        centripetal: Orbit,
        sound: AudioLines,
        soundHistory: ChartNoAxesColumn,
        soundTimer: Clock,
        bounce: Activity,
        accelSpectrum: AudioLines,
        vibration: Vibrate,
        motionTimer: Timer,
        radius: Gauge,
        gps: MapPin,
        brightness: Camera,
        color: Palette,
        opticalTimer: Timer,
        magnetometer: Magnet,
        light: Sun,
        custom: SlidersHorizontal,
      } as Partial<Record<ExperimentId, typeof Activity>>
    )[id] ?? Activity;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
