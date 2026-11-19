import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Activity,
  Type,
  Send,
  Play,
  Scissors,
  Check,
  Copy,
  Plus,
  RefreshCw,
  Flame,
  ArrowRight,
  Clock,
  Layers
} from 'lucide-react';
import {
  ChatMessage,
  DirectorAnalysis,
  CaptionItem,
  TimelineAction,
  ProjectSummary
} from '../types';
import { formatTimecode } from '../utils/timecode';

interface RightInspectorProps {
  project: ProjectSummary | null;
  currentTime: number;
  onJumpToTime: (time: number) => void;
  // Chat & Co-Pilot
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
  isStreaming: boolean;
  onApplyAction: (action: TimelineAction) => void;
  // Director Analysis
  directorAnalysis: DirectorAnalysis | null;
  onRunDirector: () => void;
  isRunningDirector: boolean;
  // Caption Styler
  captions: CaptionItem[];
  onUpdateCaptions: (caps: CaptionItem[]) => void;
  captionPreset: 'hormozi' | 'neon' | 'clean';
  onChangeCaptionPreset: (preset: 'hormozi' | 'neon' | 'clean') => void;
  onInjectCaptions: () => void;
  isInjectingCaptions: boolean;
}

export const RightInspector: React.FC<RightInspectorProps> = ({
  project,
  currentTime,
  onJumpToTime,
  messages,
  onSendMessage,
  isStreaming,
  onApplyAction,
  directorAnalysis,
  onRunDirector,
  isRunningDirector,
  captions,
  onUpdateCaptions,
  captionPreset,
  onChangeCaptionPreset,
  onInjectCaptions,
  isInjectingCaptions
}) => {
  const [activeTab, setActiveTab] = useState<'copilot' | 'audit' | 'captions'>('copilot');
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const quickPrompts = [
    'Tighten pacing to a 3-second cut rhythm',
    "Remove 'ums' and filler silences",
    'Generate dynamic 3-word Hormozi captions',
    'Suggest B-roll pattern interrupts'
  ];

  return (
    <aside className="w-96 bg-nle-surface border-l border-nle-border flex flex-col h-[calc(100vh-3.5rem)] select-none">
      {/* Inspector Tabs */}
      <div className="flex items-center border-b border-nle-border bg-nle-header/50">
        <button
          onClick={() => setActiveTab('copilot')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border-b-2 ${
            activeTab === 'copilot'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Co-Pilot</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border-b-2 ${
            activeTab === 'audit'
              ? 'border-purple-500 text-purple-400 bg-purple-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Retention Audit</span>
          {directorAnalysis && (
            <span className="text-[10px] px-1 py-0.2 rounded-full bg-purple-500/20 text-purple-300">
              {directorAnalysis.retention_score}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('captions')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border-b-2 ${
            activeTab === 'captions'
              ? 'border-fuchsia-500 text-fuchsia-400 bg-fuchsia-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Captions</span>
        </button>
      </div>

      {/* Tab 1: AI Chat & Co-Pilot */}
      {activeTab === 'copilot' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Chat Stream History */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-lg text-xs leading-relaxed space-y-2 ${
                  m.sender === 'user'
                    ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30 ml-6'
                    : 'bg-nle-bg text-slate-200 border border-nle-border mr-2 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono opacity-70">
                  <span className="font-semibold">{m.sender === 'user' ? 'You' : 'Gemini Co-Pilot'}</span>
                  <span>{m.timestamp}</span>
                </div>
                <div className="whitespace-pre-wrap">{m.text}</div>

                {/* Diff Preview / Suggested Action Card */}
                {m.suggestedAction && (
                  <div className="mt-2 p-2.5 rounded bg-slate-900 border border-emerald-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                        <Scissors className="w-3 h-3" /> Proposed Timeline Action
                      </span>
                      <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {m.suggestedAction.action_type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">{m.suggestedAction.description}</p>
                    <button
                      onClick={() => onApplyAction(m.suggestedAction!)}
                      className="w-full py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1 transition-all"
                    >
                      <Check className="w-3 h-3" /> Apply to Timeline
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Prompts Chips */}
          <div className="p-2 border-t border-nle-border/60 bg-nle-header/40 space-y-1.5">
            <div className="text-[10px] text-slate-400 font-medium px-1">Quick Editing Directives:</div>
            <div className="flex flex-wrap gap-1">
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(qp)}
                  disabled={isStreaming}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-nle-bg hover:bg-nle-hover text-slate-300 border border-nle-border hover:border-slate-500 transition-colors truncate max-w-[180px]"
                >
                  {qp}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSend} className="p-2.5 bg-nle-header border-t border-nle-border flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Direct Gemini Co-Pilot (e.g. 'Cut dead air')..."
              disabled={isStreaming}
              className="flex-1 bg-nle-bg border border-nle-border rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isStreaming || !inputText.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-md flex items-center justify-center transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Retention & Pacing Audit */}
      {activeTab === 'audit' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Trigger Button */}
          <button
            onClick={onRunDirector}
            disabled={isRunningDirector}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-60"
          >
            <Sparkles className={`w-4 h-4 ${isRunningDirector ? 'animate-spin' : ''}`} />
            <span>{isRunningDirector ? 'Gemini 2.5 Pro Thinking & Auditing...' : 'Run Full Gemini 2.5 Pro Director Audit'}</span>
          </button>

          {directorAnalysis ? (
            <div className="space-y-4">
              {/* Score Badges */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-nle-bg border border-nle-border text-center space-y-1">
                  <div className="text-[11px] text-slate-400 uppercase font-mono">Retention Score</div>
                  <div className="text-3xl font-black text-purple-400">{directorAnalysis.retention_score}</div>
                  <div className="text-[10px] text-emerald-400 font-medium">Top Tier Viral Pacing</div>
                </div>

                <div className="p-3 rounded-lg bg-nle-bg border border-nle-border text-center space-y-1">
                  <div className="text-[11px] text-slate-400 uppercase font-mono">Pacing Score</div>
                  <div className="text-3xl font-black text-blue-400">{directorAnalysis.pacing_score}</div>
                  <div className="text-[10px] text-blue-400 font-medium">Cadence ~3.2s Cuts</div>
                </div>
              </div>

              {/* Hook Critique */}
              <div className="p-3 rounded-lg bg-nle-bg border border-purple-500/30 space-y-1.5">
                <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" /> First 3-Second Hook Critique
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{directorAnalysis.hook_critique}</p>
              </div>

              {/* Clickable Timestamp Markers */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Weak Sections & Dead Air (Click to Jump)</div>
                <div className="space-y-1.5">
                  {directorAnalysis.dead_air_segments.map((da, idx) => (
                    <button
                      key={idx}
                      onClick={() => onJumpToTime(da.start_sec)}
                      className="w-full p-2 rounded bg-nle-bg hover:bg-nle-hover border border-nle-border hover:border-slate-500 text-left flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-mono text-emerald-400">{formatTimecode(da.start_sec)}</span>
                        <span className="text-slate-300 truncate max-w-[150px]">{da.reason}</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                    </button>
                  ))}
                </div>
              </div>

              {/* 3 Viral Alternative Hooks */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Viral Alternative Opening Hooks</div>
                <div className="space-y-1.5">
                  {directorAnalysis.viral_hook_alternatives.map((hook, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded bg-nle-bg border border-nle-border text-xs text-slate-300 flex items-start justify-between gap-2"
                    >
                      <span>"{hook}"</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(hook)}
                        title="Copy Hook"
                        className="p-1 rounded hover:bg-nle-hover text-slate-400 hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center rounded-lg border border-dashed border-nle-border text-slate-500 text-xs space-y-2">
              <Activity className="w-6 h-6 mx-auto text-slate-600" />
              <p>No retention audit available yet.</p>
              <p className="text-[11px] text-slate-600">Click the button above to run Gemini 2.5 Pro multimodal scene & pacing analysis.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Caption Styler */}
      {activeTab === 'captions' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Preset Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">CapCut Subtitle Style Preset</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onChangeCaptionPreset('hormozi')}
                className={`py-2 px-1 text-xs font-bold rounded border text-center transition-all ${
                  captionPreset === 'hormozi'
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                    : 'border-nle-border text-slate-400 hover:text-slate-200'
                }`}
              >
                HORMOZI
              </button>
              <button
                onClick={() => onChangeCaptionPreset('neon')}
                className={`py-2 px-1 text-xs font-bold rounded border text-center transition-all ${
                  captionPreset === 'neon'
                    ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300'
                    : 'border-nle-border text-slate-400 hover:text-slate-200'
                }`}
              >
                CYBER NEON
              </button>
              <button
                onClick={() => onChangeCaptionPreset('clean')}
                className={`py-2 px-1 text-xs font-medium rounded border text-center transition-all ${
                  captionPreset === 'clean'
                    ? 'border-blue-400 bg-blue-400/20 text-blue-300'
                    : 'border-nle-border text-slate-400 hover:text-slate-200'
                }`}
              >
                MINIMAL
              </button>
            </div>
          </div>

          {/* Subtitles List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Timeline Subtitle Blocks ({captions.length})</span>
              <button
                onClick={() => {
                  const newCap: CaptionItem = {
                    start_sec: currentTime,
                    end_sec: currentTime + 2.0,
                    text: 'NEW CAPTION',
                    highlight: false
                  };
                  onUpdateCaptions([...captions, newCap]);
                }}
                className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add at Playhead
              </button>
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {captions.map((cap, idx) => (
                <div key={idx} className="p-2.5 rounded bg-nle-bg border border-nle-border space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>
                      {formatTimecode(cap.start_sec)} → {formatTimecode(cap.end_sec)}
                    </span>
                    <button
                      onClick={() => {
                        const next = [...captions];
                        next[idx].highlight = !next[idx].highlight;
                        onUpdateCaptions(next);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        cap.highlight ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {cap.highlight ? 'HIGHLIGHT' : 'NORMAL'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={cap.text}
                    onChange={(e) => {
                      const next = [...captions];
                      next[idx].text = e.target.value;
                      onUpdateCaptions(next);
                    }}
                    className="w-full bg-nle-surface border border-nle-border rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Inject Captions Button */}
          <button
            onClick={onInjectCaptions}
            disabled={isInjectingCaptions || captions.length === 0}
            className="w-full py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
          >
            {isInjectingCaptions ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Type className="w-3.5 h-3.5" />}
            <span>Inject {captions.length} Captions to CapCut</span>
          </button>
        </div>
      )}
    </aside>
  );
};
