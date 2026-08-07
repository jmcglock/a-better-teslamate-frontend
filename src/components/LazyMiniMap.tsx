"use client";

import dynamic from "next/dynamic";

const MiniMap = dynamic(() => import("./MiniMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-52 w-full animate-pulse rounded-2xl border border-line bg-panel-2" />
  ),
});

export default MiniMap;
