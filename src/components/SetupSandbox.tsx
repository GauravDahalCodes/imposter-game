"use client";

import React, { useEffect, useRef, useState } from "react";
import { Video, VideoOff, Mic, MicOff, AlertTriangle, ShieldCheck } from "lucide-react";

interface SetupSandboxProps {
  onJoin: (username: string, stream: MediaStream) => void;
  roomId: string;
}

export default function SetupSandbox({ onJoin, roomId }: SetupSandboxProps) {
  const [username, setUsername] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState("");
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Request permissions on mount
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function initMedia() {
      try {
        const userStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: true,
        });

        activeStream = userStream;
        setStream(userStream);
        setError("");

        if (videoRef.current) {
          videoRef.current.srcObject = userStream;
        }

        // Web Audio API for visualizer
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioContext = new AudioCtx();
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;

          const source = audioContext.createMediaStreamSource(userStream);
          source.connect(analyser);

          audioContextRef.current = audioContext;
          analyserRef.current = analyser;

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const checkVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;
            
            // Map 0-255 volume to 0-100 scale with a bit of scaling factor
            const normalized = Math.min(100, Math.round((average / 120) * 100));
            setAudioLevel(normalized);

            animationFrameRef.current = requestAnimationFrame(checkVolume);
          };

          checkVolume();
        }
      } catch (err: any) {
        console.error("Error accessing media devices:", err);
        setError("Sensors Offline: Camera/Microphone access was denied. Please enable them in browser settings.");
      }
    }

    initMedia();

    return () => {
      // ⚠️ DO NOT stop stream tracks here — the stream is passed to PeerJS
      // connections when the player joins. Stopping tracks would kill camera/mic.
      // Only clean up the Web Audio API analyser loop.
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraActive(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicActive(audioTrack.enabled);
        if (!audioTrack.enabled) {
          setAudioLevel(0);
        }
      }
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    if (!stream) {
      setError("Waiting for camera/microphone initialization...");
      return;
    }
    
    // Stop local analyzer loop but DO NOT stop stream tracks since we pass them to the peer connections
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }

    onJoin(username.trim(), stream);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-screen">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-2xl border border-emerald-500/20 shadow-2xl relative">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold uppercase tracking-widest font-mono text-slate-100 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Sandbox Setup
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">Lobby: {roomId}</p>
        </div>

        {/* Video Preview */}
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner group">
          {error ? (
            <div className="p-6 text-center z-10 flex flex-col items-center gap-3">
              <AlertTriangle className="w-12 h-12 text-rose-500 animate-bounce" />
              <p className="text-sm font-mono text-rose-400 uppercase tracking-wide leading-relaxed">
                {error}
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-500 ${
                  cameraActive ? "opacity-100" : "opacity-0"
                }`}
              />
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-2">
                  <VideoOff className="w-12 h-12" />
                  <span className="text-xs uppercase font-mono tracking-wider">Optics Disabled</span>
                </div>
              )}
              {/* Media Controls floating on top */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-950/80 backdrop-blur border border-slate-800/80 px-4 py-2 rounded-full z-10 opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  type="button"
                  onClick={toggleCamera}
                  className={`p-2 rounded-full transition cursor-pointer ${
                    cameraActive
                      ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
                  }`}
                >
                  {cameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`p-2 rounded-full transition cursor-pointer ${
                    micActive
                      ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
                  }`}
                >
                  {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Audio Volume Bar */}
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3 text-emerald-400" /> Mic Diagnostics
            </span>
            <span>{micActive ? `${audioLevel}%` : "MUTED"}</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full border border-slate-900 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-75"
              style={{ width: `${micActive ? audioLevel : 0}%` }}
            />
          </div>
        </div>

        {/* Identity Form */}
        <form onSubmit={handleJoin} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono mb-2">
              Assigned Codename
            </label>
            <input
              type="text"
              required
              placeholder="ENTER YOUR NAME..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-700 font-mono text-center tracking-wide focus:outline-none focus:border-emerald-500/50 transition duration-150 uppercase"
              maxLength={15}
            />
          </div>

          <button
            type="submit"
            disabled={!stream || !username.trim()}
            className={`w-full py-4 font-bold rounded-xl border transition-all duration-200 flex items-center justify-center gap-2 uppercase tracking-widest text-sm font-mono cursor-pointer ${
              stream && username.trim()
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30 hover:border-emerald-400/50 shadow-lg shadow-emerald-950/40"
                : "bg-slate-900 text-slate-600 border-slate-950 cursor-not-allowed"
            }`}
          >
            <ShieldCheck className="w-5 h-5 animate-pulse" />
            Sync & Join Room 📡
          </button>
        </form>
      </div>
    </div>
  );
}
