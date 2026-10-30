import React, { useState } from 'react';
import { api } from '../api';
import { Sparkles, ArrowRight, ShieldCheck, User, Users, CheckCircle2, ExternalLink } from 'lucide-react';

export const JudgeTourPage: React.FC = () => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedData, setSeedData] = useState<{
    wearerUrl: string;
    helperUrl: string;
    mode: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'split' | 'wearer' | 'helper'>('split');
  const [error, setError] = useState<string | null>(null);

  const handleLaunchTour = async () => {
    setIsSeeding(true);
    setError(null);
    try {
      const data = await api.seedJudgeDemo();
      setSeedData({
        wearerUrl: data.wearer_url,
        helperUrl: data.helper_url,
        mode: data.mode,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to seed judge demo session.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-helper-light text-helper border border-helper-border/30 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive Hackathon Evaluation</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-ink mb-2">
          WearerKey 30-Second Judge Tour
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
          Experience both sides of the collaborative shopping protocol side-by-side. Inspect the
          server-enforced zero-knowledge boundary in real time.
        </p>
      </div>

      {/* Launch Box */}
      {!seedData ? (
        <div className="parcel-card p-8 bg-white border-2 border-stone text-center max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-helper-light text-helper flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="font-serif text-xl font-bold text-ink">
            Launch Pre-Seeded Evaluation Session
          </h3>
          <p className="text-xs text-ink-muted max-w-md mx-auto">
            Generates an instant session with a sanitized reference photo, permitted categories, and
            an active YouCam Clothes V4 try-on task ready for review.
          </p>
          {error && (
            <div className="p-3 rounded bg-rust-light text-rust text-xs font-medium border border-rust">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={handleLaunchTour}
            disabled={isSeeding}
            className="px-6 py-3 bg-helper hover:bg-helper-dark text-white rounded font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
          >
            {isSeeding ? (
              <span>Seeding Demo State...</span>
            ) : (
              <>
                <span>Launch Interactive Split-Screen</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="parcel-card p-4 bg-white border border-stone flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="seal-badge seal-helper font-mono text-[10px]">
                Active Seed: {seedData.mode}
              </span>
              <span className="text-xs text-ink-muted">
                Inspect both roles live below
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-parchment-200 rounded p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('split')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTab === 'split' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Split View
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('wearer')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTab === 'wearer'
                      ? 'bg-white text-wearer shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Wearer View
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('helper')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTab === 'helper'
                      ? 'bg-white text-helper shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Helper View
                </button>
              </div>

              <button
                type="button"
                onClick={handleLaunchTour}
                className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink border border-stone rounded hover:bg-stone-light/30 transition-colors"
              >
                Reset Session
              </button>
            </div>
          </div>

          {/* Interactive Split-Screen Frame */}
          {activeTab === 'split' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: Wearer */}
              <div className="parcel-border rounded-lg bg-white overflow-hidden shadow-sm flex flex-col h-[750px]">
                <div className="bg-wearer text-white px-4 py-2 flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>Role A: Private Wearer (Source Photo & Try-On Mirror)</span>
                  </div>
                  <a
                    href={seedData.wearerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <span>Full Tab</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <iframe
                  src={seedData.wearerUrl}
                  title="Wearer Room"
                  className="w-full flex-1 border-0"
                />
              </div>

              {/* Right Column: Helper */}
              <div className="parcel-border rounded-lg bg-white overflow-hidden shadow-sm flex flex-col h-[750px]">
                <div className="bg-helper text-white px-4 py-2 flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Role B: Helper / Stylist (Zero Photo Access)</span>
                  </div>
                  <a
                    href={seedData.helperUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <span>Full Tab</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <iframe
                  src={seedData.helperUrl}
                  title="Helper Room"
                  className="w-full flex-1 border-0"
                />
              </div>
            </div>
          ) : activeTab === 'wearer' ? (
            <div className="parcel-border rounded-lg bg-white overflow-hidden shadow-sm h-[750px]">
              <iframe
                src={seedData.wearerUrl}
                title="Wearer Room"
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            <div className="parcel-border rounded-lg bg-white overflow-hidden shadow-sm h-[750px]">
              <iframe
                src={seedData.helperUrl}
                title="Helper Room"
                className="w-full h-full border-0"
              />
            </div>
          )}

          {/* Judge Verification Checklist */}
          <div className="parcel-card p-5 bg-parchment-50 border border-stone">
            <h4 className="font-serif font-bold text-sm text-ink mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-wearer" />
              <span>Judge Verification Checklist</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded bg-white border border-stone">
                <div className="font-semibold text-ink flex items-center gap-1 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  Capability Auth
                </div>
                <p className="text-[11px] text-ink-muted">
                  Cryptographically hashed tokens resolve roles in constant time.
                </p>
              </div>

              <div className="p-2.5 rounded bg-white border border-stone">
                <div className="font-semibold text-ink flex items-center gap-1 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  Helper API Leaks = 0
                </div>
                <p className="text-[11px] text-ink-muted">
                  Helper endpoints never return wearer photos or try-on URLs.
                </p>
              </div>

              <div className="p-2.5 rounded bg-white border border-stone">
                <div className="font-semibold text-ink flex items-center gap-1 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  YouCam Clothes V4
                </div>
                <p className="text-[11px] text-ink-muted">
                  Asynchronous file upload, task polling, and automatic purge.
                </p>
              </div>

              <div className="p-2.5 rounded bg-white border border-stone">
                <div className="font-semibold text-ink flex items-center gap-1 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  Consent Policy Gate
                </div>
                <p className="text-[11px] text-ink-muted">
                  Server blocks off-category proposals and budget overruns.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
