import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Code2,
  Zap,
  Globe,
} from 'lucide-react';
import {
  getStoredAppwriteConfig,
  clearAppwriteCredentials,
  saveAppwriteCredentials,
  testAppwriteConnection,
  isAppwriteConfigured,
  APPWRITE_SETUP_GUIDE,
} from '../lib/appwrite';

interface AppwriteConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppwriteConfigModal: React.FC<AppwriteConfigModalProps> = ({ isOpen, onClose }) => {
  const [endpointInput, setEndpointInput] = useState('');
  const [projectIdInput, setProjectIdInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedGuide, setCopiedGuide] = useState(false);
  const [copiedHostname, setCopiedHostname] = useState(false);

  const currentConfig = getStoredAppwriteConfig();
  const isCustom = currentConfig.isCustom;

  useEffect(() => {
    if (isOpen) {
      const { endpoint, projectId } = getStoredAppwriteConfig();
      setEndpointInput(endpoint || 'https://cloud.appwrite.io/v1');
      setProjectIdInput(projectId || '');
      setTestResult(null);
      setErrorMessage(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!projectIdInput.trim()) {
      setErrorMessage('Please enter your Appwrite Project ID before testing.');
      return;
    }
    setIsTesting(true);
    setErrorMessage(null);
    setTestResult(null);
    try {
      const result = await testAppwriteConnection(endpointInput.trim(), projectIdInput.trim());
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Connection test failed.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const res = saveAppwriteCredentials(endpointInput, projectIdInput);
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save Appwrite credentials.');
      return;
    }

    setSaveSuccess(true);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleRemoveDatabase = () => {
    if (window.confirm('Are you sure you want to remove current Appwrite credentials? This will disconnect the backend and switch to local offline storage.')) {
      clearAppwriteCredentials();
      setEndpointInput('https://cloud.appwrite.io/v1');
      setProjectIdInput('');
      setTestResult(null);
      setSaveSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  };

  const handleCopyGuide = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(APPWRITE_SETUP_GUIDE);
      setCopiedGuide(true);
      setTimeout(() => setCopiedGuide(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-pink-900 via-rose-950 to-pink-900 text-white flex items-center justify-between shrink-0 border-b border-rose-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/20 border border-pink-400/30 flex items-center justify-center text-pink-300 font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-heading tracking-tight text-white flex items-center gap-2">
                <span>Appwrite Backend Credentials</span>
                {isAppwriteConfigured ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>Live Connected</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Local Storage
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-300">
                Configure your Appwrite Project ID and Endpoint for real-time multi-device sync and cloud storage.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800">
          {/* Active Status Bar */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isAppwriteConfigured
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-3">
              {isAppwriteConfigured ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-xs font-black uppercase tracking-wider">
                  {isAppwriteConfigured ? 'Appwrite Backend Online' : 'Offline / Local Demo Mode'}
                </div>
                <p className="text-xs mt-0.5 text-slate-600">
                  {isAppwriteConfigured
                    ? `Connected Project: ${currentConfig.projectId}`
                    : 'Currently operating in local storage mode. Connect Appwrite to sync orders across devices.'}
                </p>
              </div>
            </div>

            {(isAppwriteConfigured || isCustom) && (
              <button
                onClick={handleRemoveDatabase}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Disconnect Appwrite</span>
              </button>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSaveCredentials} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Appwrite Endpoint
              </label>
              <input
                type="text"
                value={endpointInput}
                onChange={(e) => setEndpointInput(e.target.value)}
                placeholder="https://cloud.appwrite.io/v1"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm font-medium text-slate-900 bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Appwrite Project ID
              </label>
              <input
                type="text"
                value={projectIdInput}
                onChange={(e) => setProjectIdInput(e.target.value)}
                placeholder="e.g. 64aef290b00123456789"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm font-medium text-slate-900 bg-slate-50/50"
              />
            </div>

            {/* Web Platform Hostname Registration Helper */}
            <div className="p-3.5 bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-2xl text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-pink-950 flex items-center gap-1.5 text-xs">
                  <Globe className="w-4 h-4 text-pink-600 shrink-0" />
                  <span>Required Web Platform Hostname:</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard && typeof window !== 'undefined') {
                      navigator.clipboard.writeText(window.location.hostname);
                      setCopiedHostname(true);
                      setTimeout(() => setCopiedHostname(false), 2000);
                    }
                  }}
                  className="px-2.5 py-1 bg-white border border-pink-300 hover:bg-pink-100 text-pink-700 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-all shrink-0"
                >
                  {copiedHostname ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedHostname ? 'Copied Hostname!' : 'Copy Hostname'}</span>
                </button>
              </div>
              <div className="font-mono text-[11px] text-pink-900 bg-white/90 px-2.5 py-1.5 rounded-lg border border-pink-200 select-all truncate">
                {typeof window !== 'undefined' ? window.location.hostname : 'ais-dev-...run.app'}
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                <b>Important:</b> In your Appwrite Console, go to <b>Project Settings &gt; Platforms &gt; Add Platform &gt; Web App</b> and paste this hostname (or <code className="bg-white px-1 py-0.5 rounded border border-pink-200 text-pink-800 font-bold">*</code> for all environments) to authorize Realtime WebSockets without Code 1008 errors.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Appwrite credentials saved successfully! Reloading...</span>
              </div>
            )}

            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{testResult.success ? 'Connection Successful' : 'Connection Failed'}</div>
                  <div className="mt-0.5 text-slate-700">{testResult.message}</div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isTesting ? <RefreshCw className="w-4 h-4 animate-spin text-pink-600" /> : <RefreshCw className="w-4 h-4 text-slate-600" />}
                <span>Test Connection</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-pink-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save & Connect</span>
                </button>
              </div>
            </div>
          </form>

          {/* Setup Guide Toggle */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-pink-600" />
                <span>Appwrite Setup Guide</span>
              </span>
              <button
                onClick={handleCopyGuide}
                className="text-xs font-bold text-pink-600 hover:text-pink-700 flex items-center gap-1 cursor-pointer"
              >
                {copiedGuide ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedGuide ? 'Copied Guide!' : 'Copy Instructions'}</span>
              </button>
            </div>
            <div className="p-3.5 bg-slate-900 rounded-2xl text-slate-200 text-[11px] font-mono whitespace-pre-wrap overflow-x-auto max-h-40 border border-slate-800">
              {APPWRITE_SETUP_GUIDE}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
