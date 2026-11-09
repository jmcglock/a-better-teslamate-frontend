"use client";

import { memo, useEffect, useRef } from "react";
import { Map, Marker } from "maplibre-gl";
import type { Map as MaplibreMap, Marker as MaplibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

function MiniMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MaplibreMap | null>(null);
  const marker = useRef<MaplibreMarker | null>(null);
  const pos = useRef({ latitude, longitude });
  pos.current = { latitude, longitude };

  useEffect(() => {
    if (!el.current || map.current) return;
    const current = pos.current;
    const created = new Map({
      container: el.current,
      style: OSM_STYLE,
      center: [current.longitude, current.latitude],
      zoom: 13.5,
      interactive: false,
      attributionControl: { compact: true },
    });
    map.current = created;
    const accent =
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#e31937";
    marker.current = new Marker({ color: accent })
      .setLngLat([current.longitude, current.latitude])
      .addTo(created);
    const onLoad = () => {
      const latest = pos.current;
      const ll: [number, number] = [latest.longitude, latest.latitude];
      marker.current?.setLngLat(ll);
      created.setCenter(ll);
    };
    created.on("load", onLoad);
    return () => {
      created.off("load", onLoad);
      created.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pin = marker.current;
    const view = map.current;
    if (!pin || !view) return;
    const ll: [number, number] = [longitude, latitude];
    pin.setLngLat(ll);
    // Recentering on every GPS tick reloads tiles and makes the map jump.
    // Slide the view only once the car leaves it.
    if (!view.loaded()) return;
    const bounds = view.getBounds();
    if (!bounds.contains(ll)) view.easeTo({ center: ll, duration: 450 });
  }, [latitude, longitude]);

  return <div ref={el} className="h-full min-h-52 w-full overflow-hidden rounded-2xl border border-line" />;
}

export default memo(MiniMap);
