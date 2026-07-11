"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { OSM_STYLE } from "./MiniMap";

export default function RouteMap({ points }: { points: { lat: number; lon: number }[] }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el.current || points.length === 0) return;
    const coords = points.map((p) => [p.lon, p.lat] as [number, number]);
    const lons = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
    const map = new maplibregl.Map({ container: el.current, style: OSM_STYLE, bounds, fitBoundsOptions: { padding: 40 } });
    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
      });
      map.addLayer({
        id: "route", type: "line", source: "route",
        paint: { "line-color": "#2e7fe0", "line-width": 3 },
      });
    });
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={el} className="h-72 w-full overflow-hidden rounded-lg border border-line" />;
}
