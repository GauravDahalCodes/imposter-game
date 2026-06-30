"use client";

import React, { useEffect, useRef, useState } from "react";
import { Shield, Check } from "lucide-react";

interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  votedFor?: string | null;
}

interface VideoGridProps {
  players: Player[];
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  phase: string;
  onVote: (targetId: string) => void;
  votedFor: string | null;
  myPeerId: string;
  votesMap: Record<string, number>;
  revealedImposterId?: string; // Only set during results phase
}

function PlayerFeed({
  player,
  stream,
  isMe,
  ticks,
  hasVotedForThis,
  showVoteOverlay,
  onVote,
  isRevealedImposter,
  phase,
}: {
  player: Player;
  stream: MediaStream | null;
  isMe: boolean;
  ticks: number;
  hasVotedForThis: boolean;
  showVoteOverlay: boolean;
  onVote: (id: string) => void;
  isRevealedImposter: boolean;
  phase: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (!stream) { setHasVideo(false); return; }
    const checkVideo = () => {
      const t = stream.getVideoTracks()[0];
      setHasVideo(!!t && t.enabled && t.readyState === "live");
    };
    checkVideo();
    const t = stream.getVideoTracks()[0];
    if (t) {
      t.addEventListener("mute", checkVideo);
      t.addEventListener("unmute", checkVideo);
      t.addEventListener("ended", checkVideo);
      return () => {
        t.removeEventListener("mute", checkVideo);
        t.removeEventListener("unmute", checkVideo);
        t.removeEventListener("ended", checkVideo);
      };
    }
  }, [stream]);

  // Border style: red pulsing for revealed imposter in results, normal otherwise
  const borderClass = isRevealedImposter
    ? "border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)] animate-pulse"
    : "border border-slate-800/80 hover:border-slate-700/80";

  return (
    <div className={`relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-950/80 transition-all duration-300 shadow-lg ${borderClass}`}>

      {/* Video or spinner */}
      {stream ? (
        <video
          ref={videoRef}
          autoPlay playsInline
          muted={isMe}
          className={`object-cover transition-opacity duration-300 ${hasVideo ? "w-full h-full opacity-100" : "w-0 h-0 opacity-0 absolute"} ${isMe ? "-scale-x-100" : ""}`}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500">Connecting…</span>
        </div>
      )}

      {/* Avatar fallback when camera locked */}
      {stream && !hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-3">
          <div className={`w-14 h-14 rounded-full border flex items-center justify-center text-lg font-black font-mono uppercase shadow-lg ${isRevealedImposter ? "bg-rose-500/15 border-rose-500/40 text-rose-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
            {player.name.slice(0, 2)}
          </div>
          <span className="text-[9px] uppercase font-mono tracking-widest text-slate-500">Audio Active</span>
        </div>
      )}

      {/* Imposter reveal tag */}
      {isRevealedImposter && (
        <div className="absolute top-2 left-2 right-2 z-10 pointer-events-none">
          <div className="bg-rose-500/25 border border-rose-500/60 text-rose-300 text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded-lg text-center backdrop-blur">
            🕵️ IMPOSTER
          </div>
        </div>
      )}

      {/* Host badge */}
      {player.isHost && !isRevealedImposter && (
        <div className="absolute top-2 left-2 z-10 pointer-events-none">
          <div className="bg-slate-950/80 backdrop-blur border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Shield className="w-2.5 h-2.5 text-emerald-400" />
            <span className="text-[8px] font-mono text-slate-300 uppercase tracking-widest">Host</span>
          </div>
        </div>
      )}

      {/* Vote ticks */}
      {ticks > 0 && (
        <div className="absolute top-2 right-2 z-10 pointer-events-none">
          <div className="bg-emerald-500/20 border border-emerald-400 text-emerald-400 font-bold px-2 py-0.5 rounded-lg text-xs font-mono backdrop-blur flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            {ticks}
          </div>
        </div>
      )}

      {/* Vote overlay */}
      {showVoteOverlay && (
        <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center p-3 opacity-0 hover:opacity-100 transition-opacity duration-200 z-20">
          <button
            onClick={() => onVote(player.id)}
            className={`w-full py-3 rounded-xl border text-xs font-mono font-bold uppercase tracking-widest cursor-pointer transition ${
              hasVotedForThis
                ? "bg-emerald-600 border-emerald-400 text-white"
                : "bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-emerald-500/30 hover:text-emerald-400"
            }`}
          >
            {hasVotedForThis ? "✅ Voted" : `Vote for ${player.name}`}
          </button>
        </div>
      )}

      {/* Username bar */}
      <div className={`absolute bottom-2 left-2 right-2 px-3 py-1.5 rounded-xl z-10 flex items-center justify-between backdrop-blur ${isRevealedImposter ? "bg-rose-950/80 border border-rose-500/20" : "bg-slate-950/85 border border-slate-900"}`}>
        <span className="text-xs font-bold font-mono text-slate-200 truncate uppercase max-w-[75%]">
          {player.name}{isMe && " (You)"}
        </span>
        <span className="text-[9px] font-mono text-slate-400 font-bold">{player.score} pts</span>
      </div>
    </div>
  );
}

export default function VideoGrid({
  players, localStream, remoteStreams,
  phase, onVote, votedFor, myPeerId, votesMap, revealedImposterId,
}: VideoGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 w-full max-w-6xl mx-auto p-2">
      {players.map((player) => {
        const isMe = player.id === myPeerId;
        const stream = isMe ? localStream : remoteStreams[player.id];
        const ticks = votesMap[player.id] || 0;
        const hasVotedForThis = votedFor === player.id;
        const showVoteOverlay = phase === "voting" && !isMe;
        const isRevealedImposter = phase === "results" && player.id === revealedImposterId;

        return (
          <PlayerFeed
            key={player.id}
            player={player}
            stream={stream}
            isMe={isMe}
            ticks={ticks}
            hasVotedForThis={hasVotedForThis}
            showVoteOverlay={showVoteOverlay}
            onVote={onVote}
            isRevealedImposter={isRevealedImposter}
            phase={phase}
          />
        );
      })}
    </div>
  );
}
