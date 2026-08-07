"use client";

import dynamic from "next/dynamic";

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-lg border border-line bg-panel-2" />
  ),
});

export default RouteMap;
