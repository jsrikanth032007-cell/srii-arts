import React, { useState, useEffect } from 'react';
import { Settings, Key, Folder, Check, AlertCircle, RefreshCw, X } from 'lucide-react';
import { SettingsData } from '../types';
import { fetchSettings, updateSettings } from '../api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [capcutDir, setCapcutDir] = useState('');
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchSettings()
        .then((data) => {
          setSettings(data);
          setCapcutDir(data.capcut_dir || '');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateSettings({
        gemini_api_key: apiKey.trim() || undefined,
        capcut_dir: capcutDir.trim() || undefined
      });
      setSavedSuccess(true);
      onSaved();
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 900);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-nle-surface border border-nle-border rounded-xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-nle-border pb-3">
          <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
            <Settings className="w-4 h-4 text-blue-400" />
            <span>Studio Settings & Pipeline Configuration</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Gemini API Key */}
          <div>
            <label className="text-xs text-slate-300 font-semibold flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-400" />
                Gemini API Key (google-genai SDK)
              </span>
              {settings?.gemini_api_key_configured && (
                <span className="text-[10px] text-emerald-400 font-normal flex items-center gap-1">
                  <Check className="w-3 h-3" /> Configured in Environment
                </span>
              )}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings?.gemini_api_key_configured ? '•••••••••••••••••••••••••••••••• (Leave blank to keep)' : 'Enter your GEMINI_API_KEY...'}
              className="w-full bg-nle-bg border border-nle-border rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Powers Gemini 2.5 Pro (Thinking Mode), Gemini 2.5 Flash Co-Pilot, and Imagen 3.0 B-Roll.
            </p>
          </div>

          {/* CapCut Projects Directory */}
          <div>
            <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5 mb-1.5">
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              Custom CapCut Projects Directory (Optional)
            </label>
            <input
              type="text"
              value={capcutDir}
              onChange={(e) => setCapcutDir(e.target.value)}
              placeholder="Defaults to %LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft"
              className="w-full bg-nle-bg border border-nle-border rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Leave blank to automatically discover drafts from your default CapCut Desktop installation.
            </p>
          </div>

          {/* Diagnostics Section */}
          <div className="p-3 rounded-lg bg-nle-bg border border-nle-border space-y-1.5 text-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">System Diagnostics</div>
            <div className="flex justify-between text-slate-300 text-[11px]">
              <span className="text-slate-500">FFmpeg Engine:</span>
              <span className="font-mono text-emerald-400 truncate max-w-[280px]" title={settings?.ffmpeg_path}>
                {settings?.ffmpeg_path || 'Detected'}
              </span>
            </div>
            <div className="flex justify-between text-slate-300 text-[11px]">
              <span className="text-slate-500">Active Models:</span>
              <span className="font-mono text-blue-400">gemini-2.5-pro • gemini-2.5-flash • imagen-3.0</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-nle-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-all ${
                savedSuccess ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : savedSuccess ? (
                <Check className="w-3.5 h-3.5" />
              ) : null}
              <span>{savedSuccess ? 'Settings Saved!' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
