"use client";

import React, { use } from "react";
import dynamic from "next/dynamic";

// Dynamically import GameRoom with SSR disabled because it relies on browser-only WebRTC / navigator APIs.
const GameRoom = dynamic(() => import("@/components/GameRoom"), {
  ssr: false,
});

interface RoomPageProps {
  params: Promise<{
    roomId: string;
  }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { roomId } = use(params);

  return (
    <main className="flex-1 w-full min-h-screen relative bg-[#060913]">
      <GameRoom roomId={roomId} />
    </main>
  );
}
