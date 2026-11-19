import React, { useState, useEffect, useRef } from 'react';
import { CommandBar } from './components/CommandBar';
import { LeftDock } from './components/LeftDock';
import { VideoMonitor } from './components/VideoMonitor';
import { Timeline } from './components/Timeline';
import { RightInspector } from './components/RightInspector';
import { SettingsModal } from './components/SettingsModal';
import { SnapshotsModal } from './components/SnapshotsModal';

import {
  ProjectListItem,
  ProjectSummary,
  CaptionItem,
  ChatMessage,
  DirectorAnalysis,
  AssetRecord,
  TimelineAction
} from './types';

import {
  fetchProjects,
  fetchProjectDetails,
  checkProjectLock,
  syncAndWriteToCapCut,
  generateProxy,
  fetchWaveform,
  executeRippleDelete,
  executeInjectCaptions,
  executeAddBRoll,
  applyPreset,
  runDirectorAnalysis,
  generateAsset,
  fetchAssets
} from './api';

export const App: React.FC = () => {
  // Global Studio State
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectSummary | null>(null);
  const [selectedModel, setSelectedModel] = useState<'gemini-2.5-pro' | 'gemini-2.5-flash'>('gemini-2.5-pro');

  // Playhead & Playback
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Audio Waveform
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);

  // Cut Zones State: array of segments/silences with is_cut toggle
  const [cutZones, setCutZones] = useState<Array<{ start_sec: number; end_sec: number; is_cut: boolean }>>([]);

  // Subtitles & Captions
  const [captions, setCaptions] = useState<CaptionItem[]>([
    { start_sec: 0.2, end_sec: 2.2, text: 'STOP WASTING TIME', highlight: true },
    { start_sec: 2.2, end_sec: 4.8, text: 'LET AI DIRECT YOUR VIDEO', highlight: false },
    { start_sec: 4.8, end_sec: 7.5, text: 'SRII ARTS NLE ENGINE', highlight: true }
  ]);
  const [captionPreset, setCaptionPreset] = useState<'hormozi' | 'neon' | 'clean'>('hormozi');

  // AI Assets
  const [assets, setAssets] = useState<AssetRecord[]>([]);

  // Director Analysis
  const [directorAnalysis, setDirectorAnalysis] = useState<DirectorAnalysis | null>(null);
  const [isRunningDirector, setIsRunningDirector] = useState<boolean>(false);

  // Co-Pilot Chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'copilot',
      text: '🎬 **Welcome to SRII ARTS Studio Director.**\nI am connected to your CapCut timeline. Ask me to tighten pacing, eliminate "ums" and dead air, generate viral 3-word Hormozi subtitles, or suggest pattern-interrupt B-roll overlays.',
      timestamp: 'Just now'
    }
  ]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  // UI Modals & Loading Flags
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const [isGeneratingProxy, setIsGeneratingProxy] = useState<boolean>(false);
  const [isGeneratingAsset, setIsGeneratingAsset] = useState<boolean>(false);
  const [isApplyingPreset, setIsApplyingPreset] = useState<boolean>(false);
  const [isInjectingCaptions, setIsInjectingCaptions] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSnapshotsOpen, setIsSnapshotsOpen] = useState<boolean>(false);

  // Initial Load: Fetch Projects & Assets
  useEffect(() => {
    loadProjectsList();
    loadAssetsList();
  }, []);

  // Keyboard Shortcuts: Spacebar Play/Pause, Arrow keys scrub
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime((t) => Math.max(0, t - 1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime((t) => Math.min(currentProject?.duration_seconds || 60, t + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentProject]);

  // Load Projects List
  const loadProjectsList = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data.projects);
      if (data.projects.length > 0 && !currentProject) {
        selectProject(data.projects[0].id);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  // Load Assets List
  const loadAssetsList = async () => {
    try {
      const data = await fetchAssets();
      setAssets(data.assets);
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  };

  // Select Project & Load Summary, Waveform & Cut Zones
  const selectProject = async (id: string) => {
    try {
      const summary = await fetchProjectDetails(id);
      setCurrentProject(summary);
      setCurrentTime(0);
      setIsPlaying(false);

      // Load Waveform
      try {
        const peaks = await fetchWaveform(id);
        setWaveformPeaks(peaks);
      } catch (e) {
        console.warn('Waveform fetch notice:', e);
      }

      // Initialize default cut zones from detected silences or timeline cadence
      const dur = summary.duration_seconds || 30;
      const initialZones = [
        { start_sec: 0, end_sec: Math.min(4.2, dur * 0.15), is_cut: false },
        { start_sec: Math.min(4.2, dur * 0.15), end_sec: Math.min(5.1, dur * 0.18), is_cut: true }, // silence
        { start_sec: Math.min(5.1, dur * 0.18), end_sec: Math.min(16.5, dur * 0.55), is_cut: false },
        { start_sec: Math.min(16.5, dur * 0.55), end_sec: Math.min(17.8, dur * 0.6), is_cut: true }, // silence
        { start_sec: Math.min(17.8, dur * 0.6), end_sec: dur, is_cut: false }
      ].filter((z) => z.end_sec > z.start_sec);

      setCutZones(initialZones);

      // Auto-populate captions if draft has text track
      const textTrack = summary.tracks.find((t) => t.type === 'text');
      if (textTrack && textTrack.segments.length > 0) {
        const extracted: CaptionItem[] = textTrack.segments.map((seg, i) => ({
          start_sec: seg.target_start_sec,
          end_sec: seg.target_start_sec + seg.target_duration_sec,
          text: seg.content_preview || `CAPTION ${i + 1}`,
          highlight: i % 2 === 0
        }));
        setCaptions(extracted);
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
    }
  };

  // Lock State Refresh
  const handleRefreshLock = async () => {
    if (!currentProject) return;
    try {
      const lockInfo = await checkProjectLock(currentProject.draft_id);
      setCurrentProject({ ...currentProject, lock_info: lockInfo });
    } catch (err) {
      console.error(err);
    }
  };

  // Sync & Write to CapCut
  const handleSyncToCapCut = async () => {
    if (!currentProject) return;
    setIsSyncing(true);
    try {
      await syncAndWriteToCapCut(currentProject.draft_id);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
      selectProject(currentProject.draft_id);
    } catch (err: any) {
      alert(`Sync Failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Generate 480p Web Proxy
  const handleGenerateProxy = async () => {
    if (!currentProject) return;
    setIsGeneratingProxy(true);
    try {
      const res = await generateProxy(currentProject.draft_id);
      selectProject(currentProject.draft_id);
    } catch (err) {
      alert(`Proxy Generation Error: ${err}`);
    } finally {
      setIsGeneratingProxy(false);
    }
  };

  // Toggle Keep/Cut Zone
  const handleToggleCutZone = (index: number) => {
    setCutZones((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], is_cut: !next[index].is_cut };
      return next;
    });
  };

  // Apply Pending Cuts (Ripple Delete)
  const handleApplyPendingCuts = async () => {
    if (!currentProject) return;
    const cutsToExecute = cutZones
      .filter((c) => c.is_cut)
      .map((c) => ({ start_sec: c.start_sec, end_sec: c.end_sec }));

    if (cutsToExecute.length === 0) return;

    try {
      const res = await executeRippleDelete(currentProject.draft_id, cutsToExecute);
      // Reload timeline state
      await selectProject(currentProject.draft_id);
    } catch (err) {
      alert(`Ripple Delete Error: ${err}`);
    }
  };

  // Apply Quick Preset
  const handleApplyPreset = async (preset: 'youtube_retention' | 'reels_high_pacing' | 'podcast_cleanup') => {
    if (!currentProject) return;
    setIsApplyingPreset(true);
    try {
      await applyPreset(currentProject.draft_id, preset);
      await selectProject(currentProject.draft_id);
    } catch (err) {
      alert(`Preset Error: ${err}`);
    } finally {
      setIsApplyingPreset(false);
    }
  };

  // Generate B-Roll Overlay with Imagen 3
  const handleGenerateAssetPrompt = async (prompt: string, aspectRatio: '16:9' | '9:16') => {
    setIsGeneratingAsset(true);
    try {
      await generateAsset(prompt, aspectRatio);
      await loadAssetsList();
    } catch (err) {
      alert(`Asset Generation Error: ${err}`);
    } finally {
      setIsGeneratingAsset(false);
    }
  };

  // Insert B-Roll onto Track V2 at Playhead
  const handleInsertBRollAtPlayhead = async (assetPath: string) => {
    if (!currentProject) return;
    try {
      await executeAddBRoll(currentProject.draft_id, assetPath, currentTime, 3.0);
      await selectProject(currentProject.draft_id);
    } catch (err) {
      alert(`Failed to insert B-roll: ${err}`);
    }
  };

  // Run Gemini 2.5 Pro Multimodal Director Audit
  const handleRunDirector = async () => {
    if (!currentProject) return;
    setIsRunningDirector(true);
    try {
      const analysis = await runDirectorAnalysis(currentProject.draft_id);
      setDirectorAnalysis(analysis);
      if (analysis.captions && analysis.captions.length > 0) {
        setCaptions(analysis.captions);
      }
    } catch (err) {
      alert(`Director Audit Failed: ${err}`);
    } finally {
      setIsRunningDirector(false);
    }
  };

  // Inject Captions to CapCut Text Track
  const handleInjectCaptions = async () => {
    if (!currentProject) return;
    setIsInjectingCaptions(true);
    try {
      await executeInjectCaptions(currentProject.draft_id, captions, captionPreset);
      await selectProject(currentProject.draft_id);
    } catch (err) {
      alert(`Caption Injection Error: ${err}`);
    } finally {
      setIsInjectingCaptions(false);
    }
  };

  // WebSocket Streaming Co-Pilot Chat
  const handleSendMessage = (text: string) => {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const copilotMsgId = `c-${Date.now()}`;
    const copilotMsg: ChatMessage = {
      id: copilotMsgId,
      sender: 'copilot',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg, copilotMsg]);
    setIsStreaming(true);

    const apiHost = import.meta.env.VITE_API_URL
      ? (import.meta.env.VITE_API_URL.startsWith('http') ? import.meta.env.VITE_API_URL : `https://${import.meta.env.VITE_API_URL}`)
      : '';

    const fallbackHttpStream = async () => {
      try {
        const response = await fetch(`${apiHost}/api/copilot/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            timeline_context: {
              draft_name: currentProject?.draft_name,
              duration_seconds: currentProject?.duration_seconds,
              current_time: currentTime,
              tracks: currentProject?.tracks
            }
          })
        });

        if (!response.body) {
          setIsStreaming(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === copilotMsgId ? { ...m, text: m.text + chunk } : m))
          );
        }

        // Parse timeline action if present
        const actionMatch = fullText.match(/```timeline_action\s*([\s\S]*?)\s*```/);
        if (actionMatch && actionMatch[1]) {
          try {
            const parsedAction = JSON.parse(actionMatch[1]);
            setMessages((prev) =>
              prev.map((m) => (m.id === copilotMsgId ? { ...m, suggestedAction: parsedAction } : m))
            );
          } catch {}
        }
      } catch (err) {
        console.error('HTTP streaming fallback error:', err);
      } finally {
        setIsStreaming(false);
      }
    };

    try {
      const cleanHost = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/^https?:\/\//, '')
        : window.location.host;
      const isHttps = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.startsWith('https')
        : window.location.protocol === 'https:';
      const wsUrl = `${isHttps ? 'wss:' : 'ws:'}//${cleanHost}/ws/copilot`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      let wsConnected = false;
      const timeoutId = setTimeout(() => {
        if (!wsConnected) {
          socket.close();
          fallbackHttpStream();
        }
      }, 2500);

      socket.onopen = () => {
        wsConnected = true;
        clearTimeout(timeoutId);
        socket.send(
          JSON.stringify({
            message: text,
            timeline_context: {
              draft_name: currentProject?.draft_name,
              duration_seconds: currentProject?.duration_seconds,
              current_time: currentTime,
              tracks: currentProject?.tracks
            }
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'token') {
            setMessages((prev) =>
              prev.map((m) => (m.id === copilotMsgId ? { ...m, text: m.text + data.content } : m))
            );
          } else if (data.type === 'done') {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== copilotMsgId) return m;
                const actionMatch = m.text.match(/```timeline_action\s*([\s\S]*?)\s*```/);
                if (actionMatch && actionMatch[1]) {
                  try {
                    const parsedAction = JSON.parse(actionMatch[1]);
                    return { ...m, suggestedAction: parsedAction };
                  } catch {
                    return m;
                  }
                }
                return m;
              })
            );
            setIsStreaming(false);
            socket.close();
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      socket.onerror = () => {
        clearTimeout(timeoutId);
        if (!wsConnected) {
          fallbackHttpStream();
        } else {
          setIsStreaming(false);
        }
      };

      socket.onclose = () => {
        clearTimeout(timeoutId);
        setIsStreaming(false);
      };
    } catch {
      fallbackHttpStream();
    }
  };

  // Apply Timeline Action suggested by Co-Pilot
  const handleApplyAction = (action: TimelineAction) => {
    if (action.action_type === 'APPLY_PRESET' && action.parameters.preset_name) {
      handleApplyPreset(action.parameters.preset_name);
    } else if (action.action_type === 'INJECT_CAPTIONS') {
      handleInjectCaptions();
    } else if (action.action_type === 'ADD_B_ROLL') {
      const asset = assets[0]?.file_path;
      if (asset) {
        handleInsertBRollAtPlayhead(asset);
      } else {
        handleGenerateAssetPrompt('Dramatic studio cyber neon overlay', '9:16');
      }
    } else if (action.action_type === 'RIPPLE_DELETE') {
      handleApplyPendingCuts();
    }
  };

  return (
    <div className="h-screen w-screen bg-nle-bg flex flex-col overflow-hidden text-slate-100 font-sans">
      {/* 1. TOP COMMAND BAR */}
      <CommandBar
        projects={projects}
        currentProject={currentProject}
        onSelectProject={selectProject}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        onOpenSnapshots={() => setIsSnapshotsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSyncToCapCut={handleSyncToCapCut}
        onRefreshLock={handleRefreshLock}
        isSyncing={isSyncing}
        syncSuccess={syncSuccess}
      />

      {/* 2. MAIN 3-COLUMN STUDIO WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT DOCK: Media Bin & AI Assets */}
        <LeftDock
          project={currentProject}
          assets={assets}
          onGenerateProxy={handleGenerateProxy}
          isGeneratingProxy={isGeneratingProxy}
          onGenerateAssetPrompt={handleGenerateAssetPrompt}
          isGeneratingAsset={isGeneratingAsset}
          onInsertBRollAtPlayhead={handleInsertBRollAtPlayhead}
          onApplyPreset={handleApplyPreset}
          isApplyingPreset={isApplyingPreset}
        />

        {/* CENTER STAGE: Video Monitor + Multi-Track Timeline */}
        <main className="flex-1 flex flex-col overflow-hidden bg-black/40">
          <VideoMonitor
            project={currentProject}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            activeCaptions={captions}
            captionStyle={captionPreset}
          />

          <Timeline
            project={currentProject}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            waveformPeaks={waveformPeaks}
            activeCaptions={captions}
            cutZones={cutZones}
            onToggleCutZone={handleToggleCutZone}
            onApplyPendingCuts={handleApplyPendingCuts}
          />
        </main>

        {/* RIGHT INSPECTOR: Co-Pilot, Retention Audit & Captions */}
        <RightInspector
          project={currentProject}
          currentTime={currentTime}
          onJumpToTime={setCurrentTime}
          messages={messages}
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          onApplyAction={handleApplyAction}
          directorAnalysis={directorAnalysis}
          onRunDirector={handleRunDirector}
          isRunningDirector={isRunningDirector}
          captions={captions}
          onUpdateCaptions={setCaptions}
          captionPreset={captionPreset}
          onChangeCaptionPreset={setCaptionPreset}
          onInjectCaptions={handleInjectCaptions}
          isInjectingCaptions={isInjectingCaptions}
        />
      </div>

      {/* MODALS */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={loadProjectsList}
      />

      <SnapshotsModal
        isOpen={isSnapshotsOpen}
        onClose={() => setIsSnapshotsOpen(false)}
        draftId={currentProject?.draft_id || ''}
        onRollbackComplete={() => selectProject(currentProject?.draft_id || '')}
      />
    </div>
  );
};
