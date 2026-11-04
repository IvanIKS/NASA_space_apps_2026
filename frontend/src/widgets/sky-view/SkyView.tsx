import { useEffect, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import type { BodyResult } from "@/entities/surface-observation";
import { TEXTURES } from "@/shared/config";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { createSkyScene, type SkyScene } from "./scene/createSkyScene";

interface SkyViewProps {
  earth: BodyResult | null;
  sun: BodyResult | null;
  latitudeDeg: number;
  longitudeDeg: number;
}

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const cardinal = (headingDeg: number) => CARDINALS[Math.round(headingDeg / 45) % 8];

/** First-person view standing at a point on the Moon. Fills its positioned parent. */
export default function SkyView({ earth, sun, latitudeDeg, longitudeDeg }: SkyViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SkyScene | null>(null);
  const [heading, setHeading] = useState(0);
  const [textureError, setTextureError] = useState(false);

  // One scene per standing point; the ground texture is remapped around it.
  useEffect(() => {
    const scene = createSkyScene(containerRef.current!, latitudeDeg, longitudeDeg, {
      onHeading: setHeading,
      onTextureError: () => setTextureError(true),
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [latitudeDeg, longitudeDeg]);

  useEffect(() => {
    sceneRef.current?.update({ earth, sun });
  }, [earth, sun, latitudeDeg, longitudeDeg]);

  return (
    <section aria-label="First-person lunar surface view" className="absolute inset-0 overflow-hidden bg-black">
      <div ref={containerRef} className="size-full" />

      {textureError && (
        <div role="alert" className="absolute top-4 left-4 rounded-md bg-red-900/90 px-3 py-2.5 text-white">
          Could not load the lunar texture at {TEXTURES.color}.
        </div>
      )}

      <div className="absolute top-4 right-4 grid gap-1 rounded-md bg-card/85 p-2.5 text-[13px]">
        <BodyRow name="Sun" color="bg-chart-3" body={sun} onLook={(az, el) => sceneRef.current?.lookAt(az, el)} />
        <BodyRow name="Earth" color="bg-chart-2" body={earth} onLook={(az, el) => sceneRef.current?.lookAt(az, el)} />
        {!earth && !sun && <div className="text-muted-foreground">Waiting for positions…</div>}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-card/85 px-2.5 py-2 text-xs text-muted-foreground tabular-nums">
        <span className="text-foreground">
          {String(heading).padStart(3, "0")}° {cardinal(heading)}
        </span>
        {" · "}Drag to look around
      </div>
    </section>
  );
}

interface BodyRowProps {
  name: string;
  color: string;
  body: BodyResult | null;
  onLook: (azimuthDeg: number, elevationDeg: number) => void;
}

function BodyRow({ name, color, body, onLook }: BodyRowProps) {
  if (!body) return null;
  const up = body.elevation_deg > 0;
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2 rounded-full", color)} />
      <span className="w-10">{name}</span>
      <span className={cn("tabular-nums", up ? "text-muted-foreground" : "text-muted-foreground/60")}>
        {up ? `${body.azimuth_deg.toFixed(0)}° · ${body.elevation_deg.toFixed(0)}°` : "below horizon"}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="ml-auto"
        title={`Look at ${name}`}
        disabled={!up}
        onClick={() => onLook(body.azimuth_deg, body.elevation_deg)}
      >
        <Crosshair />
      </Button>
    </div>
  );
}
