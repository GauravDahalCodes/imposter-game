"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Peer, { DataConnection, MediaConnection } from "peerjs";
import {
  Share2, Users, Play, RefreshCw, ShieldAlert, Award,
  Check, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2,
  Settings, Trophy, X, Sun, Moon, LayoutGrid, UserX,
} from "lucide-react";
import confetti from "canvas-confetti";
import SetupSandbox from "./SetupSandbox";
import VideoGrid from "./VideoGrid";
import { getRandomWord } from "@/lib/gameWords";
import Image from "next/image";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Player {
  id: string; name: string; score: number; isHost: boolean; votedFor?: string | null;
}
interface GameState {
  phase: "lobby" | "word-selection" | "blind-assignment" | "description" | "voting" | "results";
  players: Player[];
  secretWord: string;
  imposterId: string;
  startingPlayerIndex: number;
  roundCount: number;
  votesMap: Record<string, number>;
  winner: "civilians" | "imposter" | null;
}
const INIT: GameState = {
  phase: "lobby", players: [], secretWord: "", imposterId: "",
  startingPlayerIndex: 0, roundCount: 0, votesMap: {}, winner: null,
};

// ─── Settings panel component ────────────────────────────────────────────────
function SettingsPanel({
  open, onClose, micActive, camActive, onToggleMic, onToggleCam,
  username, onRenameUser, existingNames,
  theme, onToggleTheme,
  gridMode, onGridMode,
}: {
  open: boolean; onClose: () => void;
  micActive: boolean; camActive: boolean;
  onToggleMic: () => void; onToggleCam: () => void;
  username: string; onRenameUser: (n: string) => void; existingNames: string[];
  theme: "dark" | "light"; onToggleTheme: () => void;
  gridMode: string; onGridMode: (m: string) => void;
}) {
  const [nameInput, setNameInput] = useState(username);
  const [nameErr,   setNameErr]   = useState("");

  const grids = [
    { id: "auto", label: "Auto" },
    { id: "1",    label: "1 col" },
    { id: "2",    label: "2 col" },
    { id: "3",    label: "3 col" },
    { id: "4",    label: "4 col" },
  ];

  const handleRename = () => {
    const n = nameInput.trim();
    if (!n) return;
    if (n.toLowerCase() === username.toLowerCase()) { onClose(); return; }
    if (existingNames.map(x => x.toLowerCase()).includes(n.toLowerCase())) {
      setNameErr("Name already taken"); return;
    }
    onRenameUser(n);
    onClose();
  };

  const isPwa = typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches;

  const handleInstall = () => {
    const ev = (window as any).__pwaInstallPrompt;
    if (ev) { ev.prompt(); ev.userChoice.then(() => { (window as any).__pwaInstallPrompt = null; }); }
    else alert("To install: use your browser's 'Add to Home Screen' option.");
  };

  return (
    <>
      <div className={`settings-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <aside className={`settings-panel ${open ? "open" : ""} flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-inherit z-10">
          <span className="text-sm font-bold font-mono uppercase tracking-widest text-slate-200">Settings</span>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg transition cursor-pointer text-slate-400 hover:text-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-6 overflow-y-auto">

          {/* Media controls */}
          <section>
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">Camera & Mic</h3>
            <div className="flex gap-3">
              <button onClick={onToggleCam}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-mono uppercase tracking-widest font-bold cursor-pointer transition ${camActive ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" : "bg-rose-500/10 border-rose-500/25 text-rose-400"}`}>
                {camActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                {camActive ? "On" : "Off"}
              </button>
              <button onClick={onToggleMic}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-mono uppercase tracking-widest font-bold cursor-pointer transition ${micActive ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" : "bg-rose-500/10 border-rose-500/25 text-rose-400"}`}>
                {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                {micActive ? "On" : "Off"}
              </button>
            </div>
          </section>

          {/* Username */}
          <section>
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">Change Name</h3>
            <input
              value={nameInput}
              onChange={e => { setNameInput(e.target.value); setNameErr(""); }}
              maxLength={15}
              className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 font-mono text-sm focus:outline-none focus:border-emerald-500/50 transition uppercase tracking-wide"
            />
            {nameErr && <p className="text-rose-500 text-[10px] mt-1 font-mono">⚠️ {nameErr}</p>}
            <button onClick={handleRename}
              className="mt-2 w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 text-xs font-mono uppercase tracking-widest font-bold rounded-xl cursor-pointer transition">
              Save Name
            </button>
          </section>

          {/* Theme */}
          <section>
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">Theme</h3>
            <button onClick={onToggleTheme}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
              <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
              {theme === "dark" ? <Moon className="w-4 h-4 text-slate-400" /> : <Sun className="w-4 h-4 text-yellow-400" />}
            </button>
          </section>

          {/* Grid layout */}
          <section>
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">
              <LayoutGrid className="inline w-3.5 h-3.5 mr-1 opacity-60" />Grid Layout
            </h3>
            <div className="grid grid-cols-5 gap-1.5">
              {["auto","1","2","3","4"].map(g => (
                <button key={g} onClick={() => onGridMode(g)}
                  className={`py-2 rounded-lg border text-[10px] font-mono uppercase font-bold cursor-pointer transition ${gridMode === g ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"}`}>
                  {g === "auto" ? "Auto" : `${g}C`}
                </button>
              ))}
            </div>
          </section>

          {/* Install PWA */}
          {!isPwa && (
            <section>
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">Install App</h3>
              <button onClick={handleInstall}
                className="w-full flex items-center justify-between px-4 py-3 bg-emerald-600/10 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl cursor-pointer transition">
                <div>
                  <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest font-bold">Download PWA</p>
                  <p className="text-[9px] font-mono text-slate-500 mt-0.5">Play offline, fullscreen, no browser bar</p>
                </div>
                <Image src="/icon-192.png" alt="icon" width={32} height={32} className="rounded-lg" />
              </button>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── Leaderboard overlay ─────────────────────────────────────────────────────
function LeaderboardOverlay({ players, onClose, imposterId }: {
  players: Player[]; onClose: () => void; imposterId: string;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-panel rounded-2xl p-6 w-full max-w-sm border border-emerald-500/20 animate-slide-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold font-mono uppercase tracking-widest text-slate-100 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" /> Leaderboard
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg transition cursor-pointer text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {sorted.map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${i === 0 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-slate-900/60 border-slate-800"}`}>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-black font-mono w-6 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-slate-500"}`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`}
                </span>
                <div>
                  <span className="text-xs font-bold font-mono text-slate-200 uppercase">{p.name}</span>
                  {p.isHost && <span className="ml-2 text-[8px] text-emerald-400 font-mono uppercase">host</span>}
                </div>
              </div>
              <span className="text-sm font-black font-mono text-emerald-400">{p.score} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main GameRoom ───────────────────────────────────────────────────────────
export default function GameRoom({ roomId }: { roomId: string }) {
  const searchParams = useSearchParams();
  const isHostQuery  = searchParams.get("isHost") === "true";
  const hostIdQuery  = searchParams.get("host");

  // Presence
  const [hasJoined, setHasJoined]     = useState(false);
  const [username, setUsername]       = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [myPeerId, setMyPeerId]       = useState("");
  const [isHost, setIsHost]           = useState(isHostQuery);

  // P2P
  const peerRef  = useRef<Peer | null>(null);
  const connsRef = useRef<Record<string, DataConnection>>({});
  const callsRef = useRef<Record<string, MediaConnection>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  // State
  const [gameState, setGameState] = useState<GameState>(INIT);
  const gsRef                     = useRef<GameState>(INIT);

  // UI toggles
  const [micActive, setMicActive]         = useState(true);
  const [camActive, setCamActive]         = useState(true);
  const [copyOk, setCopyOk]               = useState(false);
  const [cardFlipped, setCardFlipped]     = useState(false);
  const [disconnected, setDisconnected]   = useState(false);
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [lbOpen, setLbOpen]               = useState(false);
  const [isFullscreen, setIsFullscreen]   = useState(false);
  const [theme, setTheme]                 = useState<"dark"|"light">("dark");
  const [gridMode, setGridMode]           = useState("auto");

  // Sync gsRef synchronously so sequential calls never race
  const sync = (gs: GameState) => { gsRef.current = gs; setGameState(gs); };
  useEffect(() => { gsRef.current = gameState; }, [gameState]);

  // Theme on <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // PWA install prompt capture
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); (window as any).__pwaInstallPrompt = e; };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Fullscreen state sync
  useEffect(() => {
    const update = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  // Mesh resolver
  useEffect(() => {
    if (hasJoined && localStream && gameState.players.length > 0) {
      resolveWebRTCMesh(gameState.players, localStream);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.players, hasJoined, localStream]);

  // Card flip
  useEffect(() => {
    if (gameState.phase === "blind-assignment") {
      setCardFlipped(false);
      const t = setTimeout(() => setCardFlipped(true), 1000);
      return () => clearTimeout(t);
    }
  }, [gameState.phase]);

  // Confetti
  useEffect(() => {
    if (gameState.phase === "results" && gameState.winner) {
      confetti({ particleCount: 160, spread: 85, origin: { y: 0.6 } });
    }
  }, [gameState.phase, gameState.winner]);

  // Heartbeat
  useEffect(() => {
    const id = setInterval(() => {
      if (isHost) broadcastState(gsRef.current);
      else { const c = hostIdQuery ? connsRef.current[hostIdQuery] : null; if (c?.open) c.send({ type: "PING" }); }
    }, 15000);
    return () => clearInterval(id);
  }, [isHost, hostIdQuery]);

  // ── P2P helpers ──────────────────────────────────────────────────────────
  const broadcastState = (s: GameState) => {
    Object.values(connsRef.current).forEach(c => { if (c.open) c.send({ type: "STATE_UPDATE", payload: s }); });
  };

  const updateAndBroadcast = useCallback((partial: Partial<GameState>) => {
    const next = { ...gsRef.current, ...partial };
    gsRef.current = next;
    setGameState(next);
    broadcastState(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveWebRTCMesh = (list: Player[], stream: MediaStream) => {
    const myId = peerRef.current?.id;
    if (!myId || !stream) return;
    list.forEach(p => {
      if (p.id === myId) return;
      if (!remoteStreams[p.id] && !callsRef.current[p.id] && myId < p.id) connectToPeerMedia(p.id, stream);
    });
  };

  const setupMediaCall = (call: MediaConnection) => {
    callsRef.current[call.peer] = call;
    call.on("stream", remote => setRemoteStreams(p => ({ ...p, [call.peer]: remote })));
    call.on("close",  ()     => { setRemoteStreams(p => { const n={...p}; delete n[call.peer]; return n; }); delete callsRef.current[call.peer]; });
    call.on("error",  ()     => { setRemoteStreams(p => { const n={...p}; delete n[call.peer]; return n; }); });
  };

  const connectToPeerMedia = (tid: string, stream: MediaStream) => {
    if (!peerRef.current) return;
    setupMediaCall(peerRef.current.call(tid, stream));
  };

  const handleDisconnect = (peerId: string) => {
    delete connsRef.current[peerId];
    callsRef.current[peerId]?.close(); delete callsRef.current[peerId];
    setRemoteStreams(p => { const n={...p}; delete n[peerId]; return n; });
    if (isHost) {
      const pl = gsRef.current.players.filter(p => p.id !== peerId);
      const vm: Record<string,number> = {};
      pl.forEach(p => { if (p.votedFor) vm[p.votedFor] = (vm[p.votedFor]||0)+1; });
      updateAndBroadcast({ players: pl, votesMap: vm });
    }
  };

  const connectToHost = (hostId: string, name: string) => {
    if (!peerRef.current) return;
    const conn = peerRef.current.connect(hostId);
    connsRef.current[hostId] = conn;
    conn.on("open",  ()      => conn.send({ type: "CLIENT_JOIN", payload: { id: peerRef.current!.id, name } }));
    conn.on("data",  (d: any) => {
      if (!d || d.type === "PING") return;
      if (d.type === "STATE_UPDATE") { const s = d.payload as GameState; gsRef.current = s; setGameState(s); }
    });
    conn.on("close", () => setDisconnected(true));
    conn.on("error", () => setDisconnected(true));
  };

  const setupGuestConn = (conn: DataConnection) => {
    connsRef.current[conn.peer] = conn;
    conn.on("data", (d: any) => {
      if (!d || d.type === "PING") return;
      if (d.type === "CLIENT_JOIN") {
        const { id, name } = d.payload as { id: string; name: string };
        const st = gsRef.current;
        if (st.players.some(p => p.id === id)) return;
        updateAndBroadcast({ players: [...st.players, { id, name, score: 0, isHost: false }] });
      }
      if (d.type === "GUEST_VOTE") {
        const { senderId, targetId } = d.payload as { senderId: string; targetId: string|null };
        const st = gsRef.current;
        const pl = st.players.map(p => p.id === senderId ? { ...p, votedFor: targetId } : p);
        const vm: Record<string,number> = {};
        pl.forEach(p => { if (p.votedFor) vm[p.votedFor] = (vm[p.votedFor]||0)+1; });
        updateAndBroadcast({ players: pl, votesMap: vm });
      }
      if (d.type === "RENAME") {
        const { senderId, newName } = d.payload as { senderId: string; newName: string };
        const st = gsRef.current;
        const pl = st.players.map(p => p.id === senderId ? { ...p, name: newName } : p);
        updateAndBroadcast({ players: pl });
      }
    });
    conn.on("close", () => handleDisconnect(conn.peer));
    conn.on("error", () => handleDisconnect(conn.peer));
  };

  const initializePeer = (name: string, stream: MediaStream) => {
    const pid  = `${roomId}-${name.replace(/[^a-zA-Z0-9]/g,"")}-${Math.floor(100+Math.random()*900)}`;
    setMyPeerId(pid);
    const peer = new Peer(pid, {
      host: "0.peerjs.com", port: 443, secure: true, debug: 1,
      config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] },
    });
    peerRef.current = peer;

    peer.on("open", id => {
      if (isHost) {
        const next = { ...INIT, players: [{ id, name, score: 0, isHost: true }] };
        gsRef.current = next; setGameState(next);
        window.history.replaceState(null,"",`${window.location.pathname}?host=${id}`);
      } else {
        if (hostIdQuery) connectToHost(hostIdQuery, name);
        else {
          setIsHost(true);
          const next = { ...INIT, players: [{ id, name, score: 0, isHost: true }] };
          gsRef.current = next; setGameState(next);
          window.history.replaceState(null,"",`${window.location.pathname}?host=${id}`);
        }
      }
    });
    peer.on("connection", setupGuestConn);
    peer.on("call",       call => { call.answer(stream); setupMediaCall(call); });
    peer.on("error",      e    => console.error("PeerJS:", e));
  };

  const handleSandboxJoin = (name: string, stream: MediaStream) => {
    setUsername(name); setLocalStream(stream); setHasJoined(true);
    initializePeer(name, stream);
  };

  // ── In-game mic/cam toggles ───────────────────────────────────────────────
  const toggleMic = () => {
    const t = localStream?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMicActive(t.enabled); }
  };
  const toggleCam = () => {
    const t = localStream?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCamActive(t.enabled); }
  };

  // ── Rename (propagate to host) ───────────────────────────────────────────
  const handleRename = (newName: string) => {
    setUsername(newName);
    if (isHost) {
      const pl = gsRef.current.players.map(p => p.id === myPeerId ? { ...p, name: newName } : p);
      updateAndBroadcast({ players: pl });
    } else {
      const hostId = hostIdQuery;
      if (hostId && connsRef.current[hostId]?.open) {
        connsRef.current[hostId].send({ type: "RENAME", payload: { senderId: myPeerId, newName } });
      }
    }
  };

  // ── Kick player (host only) ───────────────────────────────────────────────
  const handleKick = (peerId: string) => {
    if (!isHost || peerId === myPeerId) return;
    // Close data connection
    const conn = connsRef.current[peerId];
    if (conn?.open) conn.close();
    handleDisconnect(peerId);
  };

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // ── Copy invite link ──────────────────────────────────────────────────────
  const copyLink = () => {
    const hostId = isHost ? myPeerId : hostIdQuery;
    const url    = `${window.location.origin}${window.location.pathname}?host=${hostId}`;
    navigator.clipboard.writeText(url).then(() => { setCopyOk(true); setTimeout(() => setCopyOk(false), 2000); });
  };

  // ── Game actions ─────────────────────────────────────────────────────────
  const handleStart = () => updateAndBroadcast({ phase: "word-selection", secretWord: getRandomWord() });
  const handleShuffle = () => updateAndBroadcast({ secretWord: getRandomWord() });

  const launchRound = () => {
    const st = gsRef.current;
    if (st.players.length < 3) { alert("Need at least 3 players!"); return; }
    const ids = st.players.map(p => p.id);
    const imp = ids[Math.floor(Math.random() * ids.length)];
    updateAndBroadcast({
      phase: "blind-assignment",
      players: st.players.map(p => ({ ...p, votedFor: null })),
      imposterId: imp,
      startingPlayerIndex: st.roundCount % st.players.length,
      votesMap: {}, winner: null,
    });
    setTimeout(() => { if (gsRef.current.phase === "blind-assignment") updateAndBroadcast({ phase: "description" }); }, 4000);
  };

  const handleInGameShuffle = () => {
    const st  = gsRef.current;
    const ids = st.players.map(p => p.id);
    const imp = ids[Math.floor(Math.random() * ids.length)];
    updateAndBroadcast({
      phase: "blind-assignment", secretWord: getRandomWord(), imposterId: imp,
      players: st.players.map(p => ({ ...p, votedFor: null })), votesMap: {}, winner: null,
    });
    setTimeout(() => { if (gsRef.current.phase === "blind-assignment") updateAndBroadcast({ phase: "description" }); }, 4000);
  };

  const handleCallVote = () => updateAndBroadcast({ phase: "voting" });

  const handleVote = (targetId: string) => {
    if (isHost) {
      const st  = gsRef.current;
      const pl  = st.players.map(p => p.id === myPeerId ? { ...p, votedFor: p.votedFor === targetId ? null : targetId } : p);
      const vm: Record<string,number> = {};
      pl.forEach(p => { if (p.votedFor) vm[p.votedFor] = (vm[p.votedFor]||0)+1; });
      updateAndBroadcast({ players: pl, votesMap: vm });
    } else {
      const hc = hostIdQuery ? connsRef.current[hostIdQuery] : null;
      if (hc?.open) {
        const cur  = gsRef.current.players.find(p => p.id === myPeerId)?.votedFor;
        const next = cur === targetId ? null : targetId;
        hc.send({ type: "GUEST_VOTE", payload: { senderId: myPeerId, targetId: next } });
      }
    }
  };

  const handleTallyVotes = () => {
    const st = gsRef.current;
    let max = -1, topId = "", tie = false;
    Object.entries(st.votesMap).forEach(([id, c]) => {
      if (c > max) { max = c; topId = id; tie = false; } else if (c === max) { tie = true; }
    });
    if (tie || !topId) {
      updateAndBroadcast({ phase: "results", winner: "imposter",
        players: st.players.map(p => p.id === st.imposterId ? { ...p, score: p.score+20 } : p) });
      return;
    }
    if (topId === st.imposterId) {
      updateAndBroadcast({ phase: "results", winner: "civilians",
        players: st.players.map(p => p.id !== st.imposterId ? { ...p, score: p.score+20 } : p) });
    } else {
      updateAndBroadcast({ phase: "results", winner: "imposter",
        players: st.players.map(p => p.id === st.imposterId ? { ...p, score: p.score+20 } : p) });
    }
  };

  const handleNextRound = () => updateAndBroadcast({
    phase: "lobby", secretWord: "", imposterId: "", votesMap: {}, winner: null,
    roundCount: gsRef.current.roundCount + 1,
  });

  // ── Derived ──────────────────────────────────────────────────────────────
  const myPlayer   = gameState.players.find(p => p.id === myPeerId);
  const isImposter = myPeerId === gameState.imposterId;
  const turnOrder  = gameState.players.length
    ? Array.from({ length: gameState.players.length }, (_, i) =>
        gameState.players[(gameState.startingPlayerIndex + i) % gameState.players.length])
    : [];
  const imposterName = gameState.players.find(p => p.id === gameState.imposterId)?.name ?? "Unknown";
  const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (!hasJoined) return (
    <SetupSandbox
      onJoin={handleSandboxJoin}
      roomId={roomId}
      existingPlayers={gameState.players.map(p => p.name)}
    />
  );

  // ── Disconnected ──────────────────────────────────────────────────────────
  if (disconnected) return (
    <div className="flex flex-col items-center justify-center p-6 min-h-screen text-center gap-4">
      <ShieldAlert className="w-12 h-12 text-rose-500 animate-pulse" />
      <h2 className="text-2xl font-bold font-mono uppercase tracking-widest">Uplink Lost 📡</h2>
      <p className="text-slate-400 font-mono text-sm max-w-xs">Host disconnected. Return home to start a new lobby.</p>
      <button onClick={() => window.location.replace("/")}
        className="mt-2 px-6 py-3 bg-slate-900 border border-rose-500/30 hover:border-rose-500/60 text-rose-400 font-bold rounded-xl text-xs font-mono uppercase tracking-widest cursor-pointer transition">
        Go Home
      </button>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen h-dvh overflow-hidden text-slate-100">

      {/* ── Header ── */}
      <header className="border-b border-slate-900 bg-slate-950/75 backdrop-blur px-3 py-2.5 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">

          {/* Left: share + players */}
          <div className="flex items-center gap-2">
            <button onClick={copyLink}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg text-xs font-mono border border-slate-800 hover:border-emerald-500/30 transition cursor-pointer">
              {copyOk ? <><Check className="w-3.5 h-3.5 text-emerald-400" />Copied!</> : <><Share2 className="w-3.5 h-3.5" />Share</>}
            </button>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-400">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              {gameState.players.length}
            </div>
          </div>

          {/* Center: room badge */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-extrabold uppercase font-mono text-xs tracking-widest text-slate-300">
              {roomId}
            </span>
          </div>

          {/* Right: Mic/Cam quick toggles + Leaderboard + Fullscreen + Settings */}
          <div className="flex items-center gap-1.5">
            {/* Quick mic/cam */}
            <button onClick={toggleMic}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${micActive ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-rose-500/15 border-rose-500/30 text-rose-400"}`}>
              {micActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>
            <button onClick={toggleCam}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${camActive ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-rose-500/15 border-rose-500/30 text-rose-400"}`}>
              {camActive ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            </button>
            {/* Leaderboard */}
            <button onClick={() => setLbOpen(true)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-yellow-400 transition cursor-pointer">
              <Trophy className="w-3.5 h-3.5" />
            </button>
            {/* Fullscreen — hidden in PWA */}
            {!isPwa && (
              <button onClick={toggleFullscreen}
                className="pwa-hide p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 transition cursor-pointer">
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            )}
            {/* Settings */}
            <button onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition cursor-pointer">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content — flex-1 + min-h-0 so VideoGrid fills remaining space ── */}
      <main className="flex-1 min-h-0 flex flex-col max-w-6xl mx-auto w-full px-2 pt-2 pb-2 gap-2 overflow-hidden">

        {/* Phase banners — shrink-0 so they don't steal height from the grid */}
        {gameState.phase === "lobby" && (
          <div className="shrink-0 text-center glass-panel rounded-xl px-4 py-2">
            <p className="text-xs uppercase tracking-widest font-mono text-slate-400">
              {isHost
                ? gameState.players.length < 3
                  ? `${gameState.players.length}/3 players — need ${3 - gameState.players.length} more`
                  : `${gameState.players.length} players ready — start when you like!`
                : "Waiting for host to start…"}
            </p>
          </div>
        )}

        {gameState.phase === "word-selection" && (
          <div className="shrink-0 text-center glass-panel rounded-xl px-4 py-2">
            <p className="text-xs uppercase tracking-widest font-mono text-emerald-400">
              {isHost ? "🔒 Word locked & hidden — shuffle or start match" : "Host is preparing the match…"}
            </p>
          </div>
        )}

        {gameState.phase === "description" && (
          <div className="shrink-0 flex flex-col gap-1.5 max-w-lg mx-auto w-full">
            <div className="glass-panel rounded-xl px-4 py-2 text-center">
              <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest">
                🎙️ Describe in order below — host calls vote when ready
              </p>
            </div>
            <div className="glass-panel rounded-xl px-3 py-2 font-mono text-xs">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {turnOrder.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-1.5 uppercase text-slate-300 truncate">
                    <span className="text-emerald-400 font-bold w-4 shrink-0">{i+1}.</span>
                    <span className={`truncate ${p.id === myPeerId ? "text-emerald-300 font-bold" : ""}`}>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {gameState.phase === "voting" && (
          <div className="shrink-0 text-center glass-panel rounded-xl px-4 py-2 max-w-lg mx-auto w-full">
            <p className="text-xs uppercase tracking-widest font-mono text-rose-400">
              🗳️ Tap any player to vote — host seals ballots
            </p>
          </div>
        )}

        {/* Video Grid — flex-1 min-h-0 fills ALL remaining space */}
        <div className="flex-1 min-h-0">
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
            isHost={isHost}
            onKick={handleKick}
            gridMode={gridMode as any}
          />
        </div>
      </main>

      {/* ── Card flip overlay ── */}
      {gameState.phase === "blind-assignment" && (
        <div className="fixed inset-0 z-50 bg-[#060913]/90 backdrop-blur flex items-center justify-center p-4">
          <div className="perspective-1000 w-72 h-96 max-w-full">
            <div className={`w-full h-full preserve-3d relative transition-transform duration-700 ${cardFlipped ? "rotate-y-180" : ""}`}>
              {/* Front */}
              <div className="absolute inset-0 backface-hidden bg-slate-950 border-2 border-emerald-500/30 rounded-2xl flex flex-col items-center justify-center gap-4 shadow-2xl">
                <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
                <p className="text-base font-bold font-mono uppercase tracking-widest text-slate-300">Assigning roles…</p>
              </div>
              {/* Back */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl flex flex-col items-center justify-center p-8 shadow-2xl bg-slate-950">
                {isImposter ? (
                  <div className="text-center space-y-5">
                    <div className="w-20 h-20 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center mx-auto neon-border-red">
                      <ShieldAlert className="w-10 h-10 text-rose-500 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-black font-mono text-rose-500 uppercase tracking-widest neon-text-red">
                      🕵️ You&apos;re the Imposter!
                    </h2>
                    <p className="text-slate-400 font-mono text-xs uppercase tracking-widest leading-relaxed">
                      Blend in. Don&apos;t get caught.
                    </p>
                  </div>
                ) : (
                  <div className="text-center space-y-5">
                    {/* Green glow = Civilian, no text needed */}
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto neon-border-green">
                      <Award className="w-10 h-10 text-emerald-400" />
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/30 px-6 py-4 rounded-xl space-y-1">
                      <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Secret Word</p>
                      <p className="font-mono text-2xl font-extrabold text-emerald-300 uppercase tracking-widest">
                        🔑 {gameState.secretWord}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Results overlay ── */}
      {gameState.phase === "results" && (
        <div className="fixed inset-0 z-40 bg-[#060913]/92 backdrop-blur overflow-y-auto">
          <div className="flex flex-col items-center justify-center min-h-full p-4 gap-5 max-w-md mx-auto py-8">

            <h2 className="text-3xl font-black font-mono uppercase tracking-widest text-center">
              {gameState.winner === "civilians"
                ? <span className="text-emerald-400 neon-text-green">Civilians Win! 🏆</span>
                : <span className="text-rose-500 neon-text-red">Imposter Wins! 🕵️</span>}
            </h2>

            <p className="text-slate-300 font-mono text-sm text-center leading-relaxed">
              {gameState.winner === "civilians"
                ? <>You caught <strong>{imposterName}</strong>! The word was <span className="word-chip">{gameState.secretWord}</span>.</>
                : <><strong>{imposterName}</strong> survived! The word was <span className="word-chip">{gameState.secretWord}</span>.</>}
            </p>

            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">🔴 Red border = Imposter revealed</p>

            <div className="w-full">
              <VideoGrid
                players={gameState.players} localStream={localStream} remoteStreams={remoteStreams}
                phase={gameState.phase} onVote={() => {}} votedFor={null} myPeerId={myPeerId}
                votesMap={{}} revealedImposterId={gameState.imposterId}
                gridMode={gridMode as any}
              />
            </div>

            {/* Scores */}
            <div className="w-full glass-panel rounded-2xl p-4 font-mono">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">
                🎖️ Running Scores
              </h4>
              <div className="space-y-2">
                {[...gameState.players].sort((a,b) => b.score - a.score).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className={`uppercase truncate flex items-center gap-1.5 ${p.id === gameState.imposterId ? "text-rose-400" : "text-slate-300"}`}>
                      {i+1}. {p.name} {p.id === gameState.imposterId && "🕵️"}
                    </span>
                    <span className="text-emerald-400 font-bold shrink-0 ml-2">{p.score} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {isHost ? (
              <button onClick={handleNextRound}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl uppercase tracking-widest text-xs font-mono cursor-pointer flex items-center justify-center gap-2 transition">
                <RefreshCw className="w-4 h-4" /> Next Round 🔄
              </button>
            ) : (
              <p className="text-[10px] font-mono text-slate-500 uppercase animate-pulse">Waiting for host to start next round…</p>
            )}
          </div>
        </div>
      )}

      {/* ── Footer actions ── */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-900 bg-slate-950/80 backdrop-blur px-3 py-2.5 z-30 flex justify-center">
        <div className="max-w-6xl w-full flex items-center justify-center">

          {gameState.phase === "lobby" && (
            <div className="w-full max-w-sm">
              {isHost ? (
                <button onClick={handleStart}
                  disabled={gameState.players.length < 3}
                  className={`w-full py-3.5 font-bold rounded-xl border uppercase tracking-widest text-xs font-mono flex items-center justify-center gap-2 cursor-pointer transition ${
                    gameState.players.length >= 3
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30"
                      : "bg-slate-900 text-slate-600 border-slate-900 cursor-not-allowed"
                  }`}>
                  <Play className="w-4 h-4" /> Start 🚀
                </button>
              ) : (
                <div className="w-full bg-slate-900/60 border border-slate-800 px-4 py-3 rounded-xl text-center text-xs font-mono uppercase text-slate-500 tracking-widest animate-pulse">
                  Waiting for host…
                </div>
              )}
            </div>
          )}

          {gameState.phase === "word-selection" && (
            <div className="w-full max-w-sm">
              {isHost ? (
                <div className="flex gap-2">
                  <button onClick={handleShuffle}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 font-bold rounded-xl text-xs font-mono uppercase cursor-pointer transition">
                    <RefreshCw className="w-3.5 h-3.5" /> Shuffle
                  </button>
                  <button onClick={launchRound}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl border border-emerald-500/30 text-xs font-mono uppercase tracking-widest cursor-pointer transition">
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

          {gameState.phase === "description" && (
            <div className="w-full max-w-sm">
              {isHost ? (
                <div className="flex gap-2">
                  <button onClick={handleInGameShuffle}
                    title="New word + new roles, restart this round"
                    className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-900 hover:bg-rose-900/40 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 font-bold rounded-xl text-xs font-mono uppercase cursor-pointer transition">
                    <RefreshCw className="w-3.5 h-3.5" /> Reshuffle
                  </button>
                  <button onClick={handleCallVote}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl border border-amber-400/30 text-xs font-mono uppercase tracking-widest cursor-pointer transition">
                    Call Vote 🗳️
                  </button>
                </div>
              ) : (
                <div className="w-full bg-slate-900/60 border border-slate-800 px-4 py-3 rounded-xl text-center text-xs font-mono uppercase text-slate-500 tracking-widest">
                  Describe. Host calls vote.
                </div>
              )}
            </div>
          )}

          {gameState.phase === "voting" && (
            <div className="w-full max-w-sm">
              {isHost ? (
                <button onClick={handleTallyVotes}
                  disabled={Object.keys(gameState.votesMap).length === 0}
                  className={`w-full py-3.5 font-bold rounded-xl border uppercase tracking-widest text-xs font-mono cursor-pointer transition ${
                    Object.keys(gameState.votesMap).length > 0
                      ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-500/30"
                      : "bg-slate-900 text-slate-600 border-slate-900 cursor-not-allowed"
                  }`}>
                  Seal Ballots & Reveal 🔏
                </button>
              ) : (
                <div className="w-full bg-slate-900/60 border border-slate-800 px-4 py-3 rounded-xl text-center text-xs font-mono uppercase text-slate-400 tracking-widest">
                  Tap a player to cast vote!
                </div>
              )}
            </div>
          )}

        </div>
      </footer>

      {/* ── Settings panel ── */}
      <SettingsPanel
        open={settingsOpen} onClose={() => setSettingsOpen(false)}
        micActive={micActive} camActive={camActive}
        onToggleMic={toggleMic} onToggleCam={toggleCam}
        username={username} onRenameUser={handleRename}
        existingNames={gameState.players.filter(p => p.id !== myPeerId).map(p => p.name)}
        theme={theme} onToggleTheme={() => setTheme(t => t === "dark" ? "light" : "dark")}
        gridMode={gridMode} onGridMode={setGridMode}
      />

      {/* ── Leaderboard ── */}
      {lbOpen && (
        <LeaderboardOverlay
          players={gameState.players} onClose={() => setLbOpen(false)}
          imposterId={gameState.phase === "results" ? gameState.imposterId : ""}
        />
      )}
    </div>
  );
}
