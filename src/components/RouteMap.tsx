"use client";

import { useEffect, useMemo, useRef } from "react";
import { Map, Marker, type LngLatBoundsLike } from "maplibre-gl";
import type { Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { OSM_STYLE } from "./MiniMap";
import { useChartColors } from "./charts/useChartColors";

export default function RouteMap({ points }: { points: { lat: number | null; lon: number | null }[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MaplibreMap | null>(null);
  const c = useChartColors();
  const color = useRef(c.blue);
  color.current = c.blue;

  const coords = useMemo(
    () => points.flatMap((p) => (p.lat === null || p.lon === null ? [] : [[p.lon, p.lat] as [number, number]])),
    [points],
  );
  // Rebuild the map only when the route itself changes, not on every new array identity.
  const routeKey = coords.length === 0 ? "" : `${coords.length}:${coords[0]}:${coords[coords.length - 1]}`;

  useEffect(() => {
    if (!el.current || coords.length === 0) return;

    // Single recorded position: no line to draw, show a marker instead.
    if (coords.length < 2) {
      const m = new Map({ container: el.current, style: OSM_STYLE, center: coords[0], zoom: 14 });
      new Marker({ color: color.current }).setLngLat(coords[0]).addTo(m);
      map.current = m;
      return () => { m.remove(); map.current = null; };
    }

    let [minLon, minLat] = coords[0];
    let [maxLon, maxLat] = coords[0];
    for (const [lon, lat] of coords) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const bounds: LngLatBoundsLike = [
      [minLon, minLat],
      [maxLon, maxLat],
    ];
    const m = new Map({ container: el.current, style: OSM_STYLE, bounds, fitBoundsOptions: { padding: 40 } });
    m.on("load", () => {
      m.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
      });
      m.addLayer({
        id: "route", type: "line", source: "route",
        paint: { "line-color": color.current, "line-width": 3 },
      });
    });
    map.current = m;
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  // Track theme changes without recreating the map.
  useEffect(() => {
    const m = map.current;
    if (m && m.getLayer("route")) m.setPaintProperty("route", "line-color", c.blue);
  }, [c.blue]);

  return <div ref={el} className="h-72 w-full overflow-hidden rounded-lg border border-line" />;
}
