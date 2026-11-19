import React, { useState, useEffect } from 'react';
import { RotateCcw, Clock, Check, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { SnapshotItem } from '../types';
import { fetchSnapshots, rollbackSnapshot } from '../api';

interface SnapshotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftId: string;
  onRollbackComplete: () => void;
}

export const SnapshotsModal: React.FC<SnapshotsModalProps> = ({
  isOpen,
  onClose,
  draftId,
  onRollbackComplete
}) => {
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [rollingBackFile, setRollingBackFile] = useState<string | null>(null);

  const loadSnapshots = async () => {
    if (!draftId) return;
    setLoading(true);
    try {
      const data = await fetchSnapshots(draftId);
      setSnapshots(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
    }
  }, [isOpen, draftId]);

  if (!isOpen) return null;

  const handleRollback = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore snapshot "${filename}"? All unsaved mutations since this snapshot will be replaced.`)) {
      return;
    }
    setRollingBackFile(filename);
    try {
      await rollbackSnapshot(draftId, filename);
      onRollbackComplete();
      onClose();
    } catch (err) {
      alert(`Rollback failed: ${err}`);
    } finally {
      setRollingBackFile(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-nle-surface border border-nle-border rounded-xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-nle-border pb-3">
          <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span>Versioned Snapshot History & Safe Rollback</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Every AI mutation, ripple delete, and caption injection automatically captures a safety snapshot before mutating CapCut draft files.
        </p>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-slate-400 gap-2 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            <span>Loading snapshots...</span>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="p-8 text-center rounded-lg border border-dashed border-nle-border text-slate-500 text-xs">
            No snapshots recorded for this project yet. Snapshots are generated automatically when you make cuts or inject subtitles.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {snapshots.map((s) => (
              <div
                key={s.filename}
                className="p-3 rounded-lg bg-nle-bg border border-nle-border hover:border-slate-600 flex items-center justify-between transition-colors"
              >
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                    <span className="font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">
                      v{s.version}
                    </span>
                    <span>{s.label}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>{s.created_at}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRollback(s.filename)}
                  disabled={rollingBackFile === s.filename}
                  className="px-3 py-1.5 rounded-md bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {rollingBackFile === s.filename ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                  <span>Rollback</span>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-nle-border">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
