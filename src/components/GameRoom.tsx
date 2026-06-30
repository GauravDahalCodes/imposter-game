"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Peer, { DataConnection, MediaConnection } from "peerjs";
import { Share2, Users, Play, RefreshCw, ShieldAlert, Award, Check } from "lucide-react";
import confetti from "canvas-confetti";
import SetupSandbox from "./SetupSandbox";
import VideoGrid from "./VideoGrid";
import { getRandomWord } from "@/lib/gameWords";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  votedFor?: string | null;
}

interface GameState {
  phase: "lobby" | "word-selection" | "blind-assignment" | "description" | "voting" | "results";
  players: Player[];
  secretWord: string;
  imposterId: string;
  startingPlayerIndex: number; // rotates each round
  roundCount: number;
  votesMap: Record<string, number>;
  winner: "civilians" | "imposter" | null;
}

const INITIAL_STATE: GameState = {
  phase: "lobby",
  players: [],
  secretWord: "",
  imposterId: "",
  startingPlayerIndex: 0,
  roundCount: 0,
  votesMap: {},
  winner: null,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GameRoom({ roomId }: { roomId: string }) {
  const searchParams = useSearchParams();
  const isHostQuery = searchParams.get("isHost") === "true";
  const hostIdQuery = searchParams.get("host");

  const [hasJoined, setHasJoined]       = useState(false);
  const [username, setUsername]         = useState("");
  const [localStream, setLocalStream]   = useState<MediaStream | null>(null);
  const [myPeerId, setMyPeerId]         = useState("");
  const peerRef                         = useRef<Peer | null>(null);
  const connsRef                        = useRef<Record<string, DataConnection>>({});
  const callsRef                        = useRef<Record<string, MediaConnection>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  const [gameState, setGameState]       = useState<GameState>(INITIAL_STATE);
  const gsRef                           = useRef<GameState>(INITIAL_STATE); // always-current ref

  const [isHost, setIsHost]             = useState(isHostQuery);
  const [copySuccess, setCopySuccess]   = useState(false);
  const [cardFlipped, setCardFlipped]   = useState(false);
  const [disconnected, setDisconnected] = useState(false);

  // Keep ref in sync — but we ALSO sync synchronously inside updateAndBroadcast
  useEffect(() => { gsRef.current = gameState; }, [gameState]);

  // ---------------------------------------------------------------------------
  // Mesh resolver — runs whenever player list changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (hasJoined && localStream && gameState.players.length > 0) {
      resolveWebRTCMesh(gameState.players, localStream);
    }
  }, [gameState.players, hasJoined, localStream]);

  // ---------------------------------------------------------------------------
  // Card flip animation trigger
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (gameState.phase === "blind-assignment") {
      setCardFlipped(false);
      const t = setTimeout(() => setCardFlipped(true), 1000);
      return () => clearTimeout(t);
    }
  }, [gameState.phase]);

  // ---------------------------------------------------------------------------
  // Confetti on win
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (gameState.phase === "results" && gameState.winner) {
      confetti({ particleCount: 160, spread: 85, origin: { y: 0.6 } });
    }
  }, [gameState.phase, gameState.winner]);

  // ---------------------------------------------------------------------------
  // Keep-alive heartbeat
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const id = setInterval(() => {
      if (isHost) broadcastState(gsRef.current);
      else {
        const hConn = hostIdQuery ? connsRef.current[hostIdQuery] : null;
        if (hConn?.open) hConn.send({ type: "PING" });
      }
    }, 15000);
    return () => clearInterval(id);
  }, [isHost, hostIdQuery]);

  // ---------------------------------------------------------------------------
  // P2P helpers
  // ---------------------------------------------------------------------------
  const broadcastState = (state: GameState) => {
    Object.values(connsRef.current).forEach((c) => {
      if (c.open) c.send({ type: "STATE_UPDATE", payload: state });
    });
  };

  // Synchronously update ref so sequential calls never race
  const updateAndBroadcast = (partial: Partial<GameState>) => {
    const next = { ...gsRef.current, ...partial };
    gsRef.current = next;
    setGameState(next);
    broadcastState(next);
  };

  const resolveWebRTCMesh = (list: Player[], stream: MediaStream) => {
    const myId = peerRef.current?.id;
    if (!myId || !stream) return;
    list.forEach((p) => {
      if (p.id === myId) return;
      const alreadyCalling = remoteStreams[p.id] || callsRef.current[p.id];
      if (!alreadyCalling && myId < p.id) connectToPeerMedia(p.id, stream);
    });
  };

  const connectToPeerMedia = (targetId: string, stream: MediaStream) => {
    if (!peerRef.current || !stream) return;
    const call = peerRef.current.call(targetId, stream);
    setupMediaCall(call);
  };

  const setupMediaCall = (call: MediaConnection) => {
    callsRef.current[call.peer] = call;
    call.on("stream", (remote) => {
      setRemoteStreams((p) => ({ ...p, [call.peer]: remote }));
    });
    call.on("close", () => {
      setRemoteStreams((p) => { const n = { ...p }; delete n[call.peer]; return n; });
      delete callsRef.current[call.peer];
    });
    call.on("error", () => {
      setRemoteStreams((p) => { const n = { ...p }; delete n[call.peer]; return n; });
    });
  };

  const connectToHost = (hostId: string, name: string) => {
    if (!peerRef.current) return;
    const conn = peerRef.current.connect(hostId);
    connsRef.current[hostId] = conn;

    conn.on("open", () => {
      conn.send({ type: "CLIENT_JOIN", payload: { id: peerRef.current!.id, name } });
    });
    conn.on("data", (data: any) => {
      if (!data || data.type === "PING") return;
      if (data.type === "STATE_UPDATE") {
        const next = data.payload as GameState;
        gsRef.current = next;
        setGameState(next);
      }
    });
    conn.on("close", () => { setDisconnected(true); });
    conn.on("error", () => { setDisconnected(true); });
  };

  const setupDataConnectionFromGuest = (conn: DataConnection, stream: MediaStream) => {
    connsRef.current[conn.peer] = conn;

    conn.on("data", (data: any) => {
      if (!data || data.type === "PING") return;
      if (data.type === "CLIENT_JOIN") {
        const { id, name } = data.payload as { id: string; name: string };
        const state = gsRef.current;
        if (state.players.some((p) => p.id === id)) return;
        const newPlayer: Player = { id, name, score: 0, isHost: false };
        updateAndBroadcast({ players: [...state.players, newPlayer] });
      }
      if (data.type === "GUEST_VOTE") {
        const { senderId, targetId } = data.payload as { senderId: string; targetId: string | null };
        const state = gsRef.current;
        const updated = state.players.map((p) =>
          p.id === senderId ? { ...p, votedFor: targetId } : p
        );
        const vmap: Record<string, number> = {};
        updated.forEach((p) => { if (p.votedFor) vmap[p.votedFor] = (vmap[p.votedFor] || 0) + 1; });
        updateAndBroadcast({ players: updated, votesMap: vmap });
      }
    });

    conn.on("close", () => handleDisconnect(conn.peer));
    conn.on("error", () => handleDisconnect(conn.peer));
  };

  const handleDisconnect = (peerId: string) => {
    delete connsRef.current[peerId];
    if (callsRef.current[peerId]) { callsRef.current[peerId].close(); delete callsRef.current[peerId]; }
    setRemoteStreams((p) => { const n = { ...p }; delete n[peerId]; return n; });

    if (isHost) {
      const state = gsRef.current;
      const players = state.players.filter((p) => p.id !== peerId);
      const vmap: Record<string, number> = {};
      players.forEach((p) => { if (p.votedFor) vmap[p.votedFor] = (vmap[p.votedFor] || 0) + 1; });
      updateAndBroadcast({ players, votesMap: vmap });
    }
  };

  // ---------------------------------------------------------------------------
  // Init peer
  // ---------------------------------------------------------------------------
  const initializePeer = (name: string, stream: MediaStream) => {
    const clean = name.replace(/[^a-zA-Z0-9]/g, "");
    const rnd   = Math.floor(100 + Math.random() * 900);
    const pid   = `${roomId}-${clean}-${rnd}`;
    setMyPeerId(pid);

    const peer = new Peer(pid, {
      host: "0.peerjs.com", port: 443, secure: true, debug: 1,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });
    peerRef.current = peer;

    peer.on("open", (id) => {
      if (isHost) {
        const next = { ...INITIAL_STATE, players: [{ id, name, score: 0, isHost: true }] };
        gsRef.current = next;
        setGameState(next);
        window.history.replaceState(null, "", `${window.location.pathname}?host=${id}`);
      } else {
        if (hostIdQuery) connectToHost(hostIdQuery, name);
        else {
          // No host param — become host
          setIsHost(true);
          const next = { ...INITIAL_STATE, players: [{ id, name, score: 0, isHost: true }] };
          gsRef.current = next;
          setGameState(next);
          window.history.replaceState(null, "", `${window.location.pathname}?host=${id}`);
        }
      }
    });

    peer.on("connection", (conn) => setupDataConnectionFromGuest(conn, stream));
    peer.on("call", (call) => { call.answer(stream); setupMediaCall(call); });
    peer.on("error", (e) => console.error("PeerJS error:", e));
  };

  const handleSandboxJoin = (name: string, stream: MediaStream) => {
    setUsername(name);
    setLocalStream(stream);
    setHasJoined(true);
    initializePeer(name, stream);
  };

  // ---------------------------------------------------------------------------
  // Game actions (Host only)
  // ---------------------------------------------------------------------------
  const handleStart = () => {
    const word  = getRandomWord();
    updateAndBroadcast({ phase: "word-selection", secretWord: word });
  };

  const handleShuffle = () => {
    const word = getRandomWord();
    updateAndBroadcast({ secretWord: word });
  };

  // Launch match — blind role assignment
  const launchRound = (state: GameState) => {
    if (state.players.length < 3) {
      alert("At least 3 players are required!"); return;
    }
    const ids       = state.players.map((p) => p.id);
    const imposter  = ids[Math.floor(Math.random() * ids.length)];
    const startIdx  = state.roundCount % state.players.length;
    const players   = state.players.map((p) => ({ ...p, votedFor: null }));

    updateAndBroadcast({
      phase: "blind-assignment",
      players,
      imposterId: imposter,
      startingPlayerIndex: startIdx,
      votesMap: {},
      winner: null,
    });

    // Auto-transition to description after card flip (4 s)
    setTimeout(() => {
      if (gsRef.current.phase === "blind-assignment") {
        updateAndBroadcast({ phase: "description" });
      }
    }, 4000);
  };

  const handleLaunchMatch = () => launchRound(gsRef.current);

  // In-game shuffle: new word + new imposter, restart this round from card flip
  const handleInGameShuffle = () => {
    const word  = getRandomWord();
    const state = gsRef.current;
    const ids   = state.players.map((p) => p.id);
    const imp   = ids[Math.floor(Math.random() * ids.length)];
    const pl    = state.players.map((p) => ({ ...p, votedFor: null }));

    updateAndBroadcast({
      phase: "blind-assignment",
      secretWord: word,
      imposterId: imp,
      players: pl,
      votesMap: {},
      winner: null,
    });

    setTimeout(() => {
      if (gsRef.current.phase === "blind-assignment") {
        updateAndBroadcast({ phase: "description" });
      }
    }, 4000);
  };

  const handleCallVote = () => updateAndBroadcast({ phase: "voting" });

  const handleVote = (targetId: string) => {
    const myId = myPeerId;
    if (isHost) {
      const state = gsRef.current;
      const updated = state.players.map((p) =>
        p.id === myId ? { ...p, votedFor: p.votedFor === targetId ? null : targetId } : p
      );
      const vmap: Record<string, number> = {};
      updated.forEach((p) => { if (p.votedFor) vmap[p.votedFor] = (vmap[p.votedFor] || 0) + 1; });
      updateAndBroadcast({ players: updated, votesMap: vmap });
    } else {
      const hostId = hostIdQuery;
      if (hostId && connsRef.current[hostId]?.open) {
        const cur  = gsRef.current.players.find((p) => p.id === myId)?.votedFor;
        const next = cur === targetId ? null : targetId;
        connsRef.current[hostId].send({ type: "GUEST_VOTE", payload: { senderId: myId, targetId: next } });
      }
    }
  };

  const handleTallyVotes = () => {
    const state = gsRef.current;
    let max = -1, topId = "", tie = false;
    Object.entries(state.votesMap).forEach(([id, c]) => {
      if (c > max)      { max = c; topId = id; tie = false; }
      else if (c === max) { tie = true; }
    });

    // Tie or no votes → Imposter wins
    if (tie || !topId) {
      const players = state.players.map((p) =>
        p.id === state.imposterId ? { ...p, score: p.score + 20 } : p
      );
      updateAndBroadcast({ phase: "results", winner: "imposter", players });
      return;
    }

    if (topId === state.imposterId) {
      // Civilians caught imposter
      const players = state.players.map((p) =>
        p.id !== state.imposterId ? { ...p, score: p.score + 20 } : p
      );
      updateAndBroadcast({ phase: "results", winner: "civilians", players });
    } else {
      // Wrong person voted out → Imposter wins
      const players = state.players.map((p) =>
        p.id === state.imposterId ? { ...p, score: p.score + 20 } : p
      );
      updateAndBroadcast({ phase: "results", winner: "imposter", players });
    }
  };

  const handleNextRound = () => {
    updateAndBroadcast({
      phase: "lobby",
      secretWord: "",
      imposterId: "",
      votesMap: {},
      winner: null,
      roundCount: gsRef.current.roundCount + 1,
    });
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?host=${isHost ? myPeerId : hostIdQuery}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  if (!hasJoined) return <SetupSandbox onJoin={handleSandboxJoin} roomId={roomId} />;

  if (disconnected) return (
    <div className="flex flex-col items-center justify-center p-6 min-h-screen text-center">
      <ShieldAlert className="w-12 h-12 text-rose-500 animate-pulse mb-4" />
      <h2 className="text-2xl font-bold font-mono uppercase tracking-widest text-slate-100">Uplink Lost 📡</h2>
      <p className="text-slate-400 font-mono text-sm max-w-sm mt-3">The host disconnected. Return home to start a new lobby.</p>
      <button onClick={() => window.location.replace("/")}
        className="mt-6 px-6 py-3 bg-slate-900 border border-rose-500/30 hover:border-rose-500/60 text-rose-400 font-bold rounded-xl transition uppercase tracking-widest text-xs cursor-pointer">
        Return to Home
      </button>
    </div>
  );

  const myPlayer     = gameState.players.find((p) => p.id === myPeerId);
  const isImposter   = myPeerId === gameState.imposterId;
  const turnSequence = (() => {
    const len = gameState.players.length;
    if (!len) return [] as Player[];
    return Array.from({ length: len }, (_, i) =>
      gameState.players[(gameState.startingPlayerIndex + i) % len]
    );
  })();

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col min-h-screen text-slate-100 pb-24">

      {/* ── Header ── */}
      <header className="border-b border-slate-900 bg-slate-950/70 backdrop-blur px-4 py-3 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-extrabold uppercase font-mono text-xs tracking-widest text-slate-300">
              U.I. / <span className="text-emerald-400">{roomId}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg text-xs font-mono border border-slate-800 hover:border-emerald-500/30 transition cursor-pointer">
              {copySuccess ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</> : <><Share2 className="w-3.5 h-3.5" /> Share</>}
            </button>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              {gameState.players.length}
            </div>
          </div>
        </div>
      </header>

      {/* ── Phase banner ── */}
      <main className="flex-1 flex flex-col justify-start max-w-6xl mx-auto w-full p-3 gap-3">

        {gameState.phase === "lobby" && (
          <div className="text-center glass-panel rounded-xl px-4 py-3 max-w-lg mx-auto w-full">
            <p className="text-xs uppercase tracking-widest font-mono text-slate-400">
              {isHost ? `${gameState.players.length} operative(s) connected — need 3 to start` : "Waiting for host to start…"}
            </p>
          </div>
        )}

        {gameState.phase === "word-selection" && (
          <div className="text-center glass-panel rounded-xl px-4 py-3 max-w-lg mx-auto w-full">
            <p className="text-xs uppercase tracking-widest font-mono text-emerald-400">
              {isHost ? "🔒 Secret word locked — nobody can see it yet" : "Host is preparing the match…"}
            </p>
          </div>
        )}

        {gameState.phase === "description" && (
          <div className="max-w-lg mx-auto w-full space-y-3">
            <div className="glass-panel rounded-xl px-4 py-3 text-center">
              <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest">
                🎙️ All unmuted — describe your word in order below
              </p>
            </div>
            {/* Turn order list */}
            <div className="glass-panel rounded-xl p-4 font-mono text-xs space-y-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                📋 Description Order
              </p>
              {turnSequence.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 text-slate-300 uppercase">
                  <span className="text-emerald-400 font-bold w-4">{i + 1}.</span>
                  <span className={p.id === myPeerId ? "text-emerald-300 font-bold" : ""}>{p.name}</span>
                  {p.id === myPeerId && <span className="text-[9px] text-slate-500 ml-auto">(you)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {gameState.phase === "voting" && (
          <div className="text-center glass-panel rounded-xl px-4 py-3 max-w-lg mx-auto w-full animate-pulse">
            <p className="text-xs uppercase tracking-widest font-mono text-rose-400">
              🗳️ Tap a player grid to vote — host will seal the ballots
            </p>
          </div>
        )}

        {/* ── Video grid ── */}
        <VideoGrid
          players={gameState.players}
          localStream={localStream}
          remoteStreams={remoteStreams}
          phase={gameState.phase}
          onVote={handleVote}
          votedFor={myPlayer?.votedFor ?? null}
          myPeerId={myPeerId}
          votesMap={gameState.votesMap}
          revealedImposterId={gameState.phase === "results" ? gameState.imposterId : undefined}
        />
      </main>

      {/* ── Card flip overlay (Phase 3) ── */}
      {gameState.phase === "blind-assignment" && (
        <div className="fixed inset-0 z-50 bg-[#060913]/90 backdrop-blur flex items-center justify-center p-4">
          <div className="perspective-1000 w-80 h-96 max-w-full">
            <div className={`w-full h-full duration-700 preserve-3d relative transition-transform ${cardFlipped ? "rotate-y-180" : ""}`}>
              {/* Front */}
              <div className="absolute inset-0 backface-hidden bg-slate-950 border-2 border-emerald-500/30 rounded-2xl flex flex-col items-center justify-center p-6 shadow-2xl">
                <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
                <p className="text-lg font-bold font-mono uppercase tracking-widest text-slate-300">Assigning roles…</p>
              </div>
              {/* Back */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl flex flex-col items-center justify-center p-8 shadow-2xl bg-slate-950 border-2">
                {isImposter ? (
                  <div className="text-center space-y-5">
                    <div className="w-20 h-20 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center mx-auto neon-border-red">
                      <ShieldAlert className="w-10 h-10 text-rose-500 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-black font-mono text-rose-500 uppercase tracking-widest neon-text-red">
                      🕵️ You're the Imposter!
                    </h2>
                    <p className="text-slate-400 font-mono text-xs uppercase tracking-widest leading-relaxed">
                      Blend in. Don't get caught.
                    </p>
                  </div>
                ) : (
                  <div className="text-center space-y-5">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto neon-border-green">
                      <Award className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-black font-mono text-emerald-400 uppercase tracking-widest neon-text-green">
                      Civilian
                    </h2>
                    <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Secret Word</p>
                    <div className="bg-emerald-500/10 border border-emerald-500/30 px-6 py-3 rounded-xl font-mono text-2xl font-extrabold text-emerald-300 uppercase tracking-widest">
                      🔑 {gameState.secretWord}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Results overlay (Phase 6) ── */}
      {gameState.phase === "results" && (
        <div className="fixed inset-0 z-40 bg-[#060913]/92 backdrop-blur flex flex-col p-6 overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto gap-6 py-8">

            {/* Win/Loss headline */}
            <div>
              <h2 className="text-3xl font-black font-mono uppercase tracking-widest">
                {gameState.winner === "civilians"
                  ? <span className="text-emerald-400 neon-text-green">Civilians Win! 🏆</span>
                  : <span className="text-rose-500 neon-text-red">Imposter Wins! 🕵️</span>}
              </h2>
              {/* Identify imposter */}
              <p className="text-slate-400 font-mono text-sm mt-3">
                {gameState.winner === "civilians"
                  ? `You caught ${gameState.players.find(p => p.id === gameState.imposterId)?.name || "the imposter"}! The secret word was "${gameState.secretWord}".`
                  : `${gameState.players.find(p => p.id === gameState.imposterId)?.name || "The imposter"} survived! The word was "${gameState.secretWord}".`
                }
              </p>
            </div>

            {/* Live video grid with red border on imposter */}
            <div className="w-full">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Red border = Imposter revealed</p>
              <VideoGrid
                players={gameState.players}
                localStream={localStream}
                remoteStreams={remoteStreams}
                phase={gameState.phase}
                onVote={() => {}}
                votedFor={null}
                myPeerId={myPeerId}
                votesMap={{}}
                revealedImposterId={gameState.imposterId}
              />
            </div>

            {/* Scoreboard */}
            <div className="w-full glass-panel rounded-2xl p-5 font-mono text-left">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">
                🎖️ Running Scores
              </h4>
              <div className="space-y-2.5">
                {[...gameState.players]
                  .sort((a, b) => b.score - a.score)
                  .map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className={`uppercase truncate max-w-[70%] flex items-center gap-1.5 ${p.id === gameState.imposterId ? "text-rose-400" : "text-slate-300"}`}>
                        {i + 1}. {p.name} {p.id === gameState.imposterId && "🕵️"}
                      </span>
                      <span className="text-emerald-400 font-bold">{p.score} pts</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Host: next round */}
            {isHost && (
              <button onClick={handleNextRound}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition uppercase tracking-widest text-xs font-mono cursor-pointer flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Next Round 🔄
              </button>
            )}
            {!isHost && (
              <p className="text-[10px] font-mono text-slate-500 uppercase animate-pulse">Waiting for host to start next round…</p>
            )}
          </div>
        </div>
      )}

      {/* ── Sticky footer actions ── */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-900 bg-slate-950/80 backdrop-blur px-4 py-3 z-30 flex justify-center">
        <div className="max-w-6xl w-full flex items-center justify-center min-h-[52px]">

          {/* LOBBY */}
          {gameState.phase === "lobby" && (
            <div className="w-full max-w-sm">
              {isHost ? (
                <button onClick={handleStart}
                  disabled={gameState.players.length < 3}
                  className={`w-full py-3.5 font-bold rounded-xl transition border uppercase tracking-widest text-xs font-mono flex items-center justify-center gap-2 cursor-pointer ${
                    gameState.players.length >= 3
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30"
                      : "bg-slate-900 text-slate-600 border-slate-900 cursor-not-allowed"
                  }`}>
                  <Play className="w-4 h-4" /> Start 🚀
                </button>
              ) : (
                <div className="w-full bg-slate-900/60 border border-slate-800 px-4 py-3 rounded-xl text-center text-xs font-mono uppercase text-slate-500 tracking-widest animate-pulse">
                  Waiting for host to start…
                </div>
              )}
            </div>
          )}

          {/* WORD SELECTION */}
          {gameState.phase === "word-selection" && (
            <div className="w-full max-w-sm">
              {isHost ? (
                <div className="flex gap-2">
                  <button onClick={handleShuffle}
                    title="Pick a different word — still hidden from everyone"
                    className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 font-bold rounded-xl transition text-xs font-mono uppercase cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" /> Shuffle
                  </button>
                  <button onClick={handleLaunchMatch}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl border border-emerald-500/30 transition text-xs font-mono uppercase tracking-widest cursor-pointer">
                    Start Match 🚀
                  </button>
                </div>
              ) : (
                <div className="w-full bg-slate-900/60 border border-slate-800 px-4 py-3 rounded-xl text-center text-xs font-mono uppercase text-slate-500 tracking-widest animate-pulse">
                  Host is preparing…
                </div>
              )}
            </div>
          )}

          {/* DESCRIPTION */}
          {gameState.phase === "description" && (
            <div className="w-full max-w-sm">
              {isHost ? (
                <div className="flex gap-2">
                  <button onClick={handleInGameShuffle}
                    title="Word too hard? Reshuffle word + roles and restart this round"
                    className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 font-bold rounded-xl transition text-xs font-mono uppercase cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" /> Reshuffle
                  </button>
                  <button onClick={handleCallVote}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl border border-amber-400/30 transition text-xs font-mono uppercase tracking-widest cursor-pointer">
                    Call Vote 🗳️
                  </button>
                </div>
              ) : (
                <div className="w-full bg-slate-900/60 border border-slate-800 px-4 py-3 rounded-xl text-center text-xs font-mono uppercase text-slate-500 tracking-widest">
                  Describe your word. Host will call vote when ready.
                </div>
              )}
            </div>
          )}

          {/* VOTING */}
          {gameState.phase === "voting" && (
            <div className="w-full max-w-sm">
              {isHost ? (
                <button onClick={handleTallyVotes}
                  disabled={Object.keys(gameState.votesMap).length === 0}
                  className={`w-full py-3.5 font-bold rounded-xl transition border uppercase tracking-widest text-xs font-mono cursor-pointer ${
                    Object.keys(gameState.votesMap).length > 0
                      ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-500/30"
                      : "bg-slate-900 text-slate-600 border-slate-900 cursor-not-allowed"
                  }`}>
                  Seal Ballots & Reveal 🔏
                </button>
              ) : (
                <div className="w-full bg-slate-900/60 border border-slate-800 px-4 py-3 rounded-xl text-center text-xs font-mono uppercase text-slate-400 tracking-widest">
                  Tap a player grid to vote!
                </div>
              )}
            </div>
          )}

        </div>
      </footer>
    </div>
  );
}
