"use client";

import React, { useEffect, useRef, useState } from "react";
import { Video, VideoOff, Mic, MicOff, AlertTriangle, ShieldCheck } from "lucide-react";

interface SetupSandboxProps {
  onJoin: (username: string, stream: MediaStream) => void;
  roomId: string;
  existingPlayers?: string[]; // for duplicate name check
}

export default function SetupSandbox({ onJoin, roomId, existingPlayers = [] }: SetupSandboxProps) {
  const [username, setUsername]       = useState("");
  const [stream, setStream]           = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel]   = useState(0);
  const [error, setError]             = useState("");
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive]     = useState(true);

  const videoRef          = useRef<HTMLVideoElement>(null);
  const audioContextRef   = useRef<AudioContext | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    async function initMedia() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: true,
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx      = new AudioCtx();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          ctx.createMediaStreamSource(s).connect(analyser);
          audioContextRef.current = ctx;
          analyserRef.current     = analyser;

          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            setAudioLevel(Math.min(100, Math.round((avg / 120) * 100)));
            animationFrameRef.current = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch {
        setError("Camera/Microphone access denied. Enable them in browser settings.");
      }
    }
    initMedia();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  const toggleCamera = () => {
    const t = stream?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCameraActive(t.enabled); }
  };
  const toggleMic = () => {
    const t = stream?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMicActive(t.enabled); if (!t.enabled) setAudioLevel(0); }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;
    if (!stream) { setError("Waiting for camera/mic…"); return; }
    if (existingPlayers.map(n => n.toLowerCase()).includes(name.toLowerCase())) {
      setError("That name is already taken — pick another"); return;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    audioContextRef.current?.close().catch(() => {});
    onJoin(name, stream);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-screen">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-sm glass-panel p-6 rounded-2xl border border-emerald-500/20 shadow-2xl relative">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest font-mono text-slate-300">
              Room: {roomId}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">Set up your camera &amp; name before joining</p>
        </div>

        {/* Camera preview */}
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner group">
          {error ? (
            <div className="p-6 text-center flex flex-col items-center gap-3">
              <AlertTriangle className="w-10 h-10 text-rose-500 animate-bounce" />
              <p className="text-sm font-mono text-rose-400 leading-relaxed">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef} autoPlay playsInline muted
                className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-300 ${cameraActive ? "opacity-100" : "opacity-0"}`}
              />
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-2">
                  <VideoOff className="w-10 h-10" />
                  <span className="text-xs uppercase font-mono tracking-wider">Camera Off</span>
                </div>
              )}
              {/* Controls */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-3 bg-slate-950/80 backdrop-blur border border-slate-800/80 px-4 py-2 rounded-full z-10 opacity-80 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={toggleCamera}
                  className={`p-2 rounded-full transition cursor-pointer ${cameraActive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                  {cameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
                <button type="button" onClick={toggleMic}
                  className={`p-2 rounded-full transition cursor-pointer ${micActive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                  {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Audio level */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono uppercase tracking-widest">
            <span className="flex items-center gap-1"><Mic className="w-3 h-3 text-emerald-400" /> Mic level</span>
            <span>{micActive ? `${audioLevel}%` : "Muted"}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-950 rounded-full border border-slate-900 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75"
              style={{ width: `${micActive ? audioLevel : 0}%` }} />
          </div>
        </div>

        {/* Name form */}
        <form onSubmit={handleJoin} className="mt-5 space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest font-mono mb-2">
              Your Name
            </label>
            <input
              type="text" required maxLength={15}
              placeholder="ENTER YOUR NAME…"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-700 font-mono text-center tracking-wide focus:outline-none focus:border-emerald-500/50 transition uppercase"
            />
          </div>
          {error && <p className="text-rose-500 text-xs font-mono">⚠️ {error}</p>}
          <button type="submit"
            disabled={!stream || !username.trim()}
            className={`w-full py-4 font-bold rounded-xl border transition flex items-center justify-center gap-2 uppercase tracking-widest text-sm font-mono cursor-pointer ${
              stream && username.trim()
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30 shadow-lg"
                : "bg-slate-900 text-slate-600 border-slate-950 cursor-not-allowed"
            }`}>
            <ShieldCheck className="w-5 h-5" /> Join Room 📡
          </button>
        </form>
      </div>
    </div>
  );
}
