"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { OSM_STYLE } from "./MiniMap";
import { useChartColors } from "./charts/useChartColors";

export default function RouteMap({ points }: { points: { lat: number; lon: number }[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const c = useChartColors();

  useEffect(() => {
    if (!el.current || map.current || points.length === 0) return;
    const coords = points.map((p) => [p.lon, p.lat] as [number, number]);

    // Single recorded position: no line to draw, show a marker instead.
    if (coords.length < 2) {
      const m = new maplibregl.Map({ container: el.current, style: OSM_STYLE, center: coords[0], zoom: 14 });
      new maplibregl.Marker({ color: c.blue }).setLngLat(coords[0]).addTo(m);
      map.current = m;
      return () => { m.remove(); map.current = null; };
    }

    const lons = coords.map((p) => p[0]);
    const lats = coords.map((p) => p[1]);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
    const m = new maplibregl.Map({ container: el.current, style: OSM_STYLE, bounds, fitBoundsOptions: { padding: 40 } });
    m.on("load", () => {
      m.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
      });
      m.addLayer({
        id: "route", type: "line", source: "route",
        paint: { "line-color": c.blue, "line-width": 3 },
      });
    });
    map.current = m;
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track theme changes without recreating the map.
  useEffect(() => {
    const m = map.current;
    if (m && m.getLayer("route")) m.setPaintProperty("route", "line-color", c.blue);
  }, [c.blue]);

  return <div ref={el} className="h-72 w-full overflow-hidden rounded-lg border border-line" />;
}
