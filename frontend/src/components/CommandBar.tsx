import React, { useState } from 'react';
import {
  Film,
  Sparkles,
  Lock,
  Unlock,
  RotateCcw,
  Settings,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { ProjectListItem, ProjectSummary, LockInfo } from '../types';
import { formatDurationHuman } from '../utils/timecode';

interface CommandBarProps {
  projects: ProjectListItem[];
  currentProject: ProjectSummary | null;
  onSelectProject: (id: string) => void;
  selectedModel: 'gemini-2.5-pro' | 'gemini-2.5-flash';
  onSelectModel: (model: 'gemini-2.5-pro' | 'gemini-2.5-flash') => void;
  onOpenSnapshots: () => void;
  onOpenSettings: () => void;
  onSyncToCapCut: () => void;
  onRefreshLock: () => void;
  isSyncing: boolean;
  syncSuccess: boolean;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  projects,
  currentProject,
  onSelectProject,
  selectedModel,
  onSelectModel,
  onOpenSnapshots,
  onOpenSettings,
  onSyncToCapCut,
  onRefreshLock,
  isSyncing,
  syncSuccess
}) => {
  const lockInfo: LockInfo = currentProject?.lock_info || {
    locked: false,
    capcut_running: false,
    running_pids: [],
    error: null,
    status: 'READY'
  };

  return (
    <header className="h-14 bg-nle-header border-b border-nle-border px-4 flex items-center justify-between select-none z-30">
      {/* Left: Brand & Project Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 pr-3 border-r border-nle-border">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-wider text-slate-100">SRII ARTS</span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">NLE PRO</span>
            </div>
          </div>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Project:</span>
          <select
            value={currentProject?.draft_id || ''}
            onChange={(e) => onSelectProject(e.target.value)}
            className="bg-nle-surface text-slate-200 text-xs font-medium rounded-md px-2.5 py-1.5 border border-nle-border hover:border-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[180px]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatDurationHuman(p.duration_seconds)}) {p.is_sample ? '★ Sample' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* CapCut Lock Status Badge */}
        <div className="flex items-center gap-1.5 pl-2">
          {lockInfo.locked || lockInfo.capcut_running ? (
            <div
              title={lockInfo.capcut_running ? 'CapCut process active (auto-safeguard active)' : 'File locked'}
              className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px]"
            >
              <Lock className="w-3 h-3 text-amber-400" />
              <span>CapCut Active</span>
              <button
                onClick={onRefreshLock}
                title="Refresh lock state"
                className="hover:text-amber-200 ml-1 p-0.5 rounded hover:bg-amber-500/20"
              >
                <RefreshCw className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <div
              title="CapCut draft safe to mutate"
              className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]"
            >
              <Unlock className="w-3 h-3 text-emerald-400" />
              <span>CapCut Ready</span>
              <button
                onClick={onRefreshLock}
                title="Refresh lock state"
                className="hover:text-emerald-200 ml-1 p-0.5 rounded hover:bg-emerald-500/20"
              >
                <RefreshCw className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: Gemini Model Selector */}
      <div className="flex items-center gap-1 bg-nle-surface p-1 rounded-lg border border-nle-border">
        <button
          onClick={() => onSelectModel('gemini-2.5-pro')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            selectedModel === 'gemini-2.5-pro'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-nle-hover'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gemini 2.5 Pro Director</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-900/60 text-purple-200 border border-purple-400/30">Thinking</span>
        </button>

        <button
          onClick={() => onSelectModel('gemini-2.5-flash')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            selectedModel === 'gemini-2.5-flash'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-nle-hover'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Gemini 2.5 Flash Co-Pilot</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-blue-900/60 text-blue-200 border border-blue-400/30">Live</span>
        </button>
      </div>

      {/* Right: Snapshots, Settings & Sync CTA */}
      <div className="flex items-center gap-2.5">
        {/* Versioned Snapshot Rollback */}
        <button
          onClick={onOpenSnapshots}
          title="Snapshot History & Rollback"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-nle-surface hover:bg-nle-hover text-slate-300 border border-nle-border text-xs transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>Snapshots</span>
          {currentProject && currentProject.snapshots_count > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] font-mono rounded-full bg-slate-700 text-slate-300">
              {currentProject.snapshots_count}
            </span>
          )}
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title="Project & API Settings"
          className="p-2 rounded-md bg-nle-surface hover:bg-nle-hover text-slate-300 border border-nle-border transition-colors"
        >
          <Settings className="w-4 h-4 text-slate-400" />
        </button>

        {/* Sync & Write to CapCut Button */}
        <button
          onClick={onSyncToCapCut}
          disabled={isSyncing}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md font-semibold text-xs tracking-wide transition-all shadow-md ${
            syncSuccess
              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
              : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-blue-500/20'
          } ${isSyncing ? 'opacity-70 cursor-wait' : ''}`}
        >
          {isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : syncSuccess ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>{isSyncing ? 'Writing to CapCut...' : syncSuccess ? 'Synced to CapCut!' : 'Sync & Write to CapCut'}</span>
        </button>
      </div>
    </header>
  );
};
