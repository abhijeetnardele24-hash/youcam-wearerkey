import React, { useState } from 'react';
import { Eye, ShieldAlert, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';

interface PrivateMirrorProps {
  sourceImageUrl?: string;
  resultImageUrl?: string;
  resultUrl?: string | null;
  garmentPreviewUrl?: string | null;
  garmentTitle?: string;
  label?: string;
  status?: string;
  failureMessage?: string | null;
  isProcessing?: boolean;
}

export const PrivateMirror: React.FC<PrivateMirrorProps> = ({
  sourceImageUrl,
  resultImageUrl,
  resultUrl,
  garmentPreviewUrl,
  garmentTitle,
  label,
  status,
  failureMessage,
  isProcessing = false,
}) => {
  const displayResultUrl = resultImageUrl || resultUrl || undefined;
  const displayTitle = garmentTitle || label || 'Proposed Garment';
  const [viewMode, setViewMode] = useState<'three-stage' | 'result' | 'split' | 'source'>('three-stage');
  const [zoom, setZoom] = useState(false);

  return (
    <div className="parcel-card overflow-hidden bg-white border-2 border-wearer/40">
      {/* Header bar */}
      <div className="bg-wearer text-white px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-parchment" />
          <span className="font-semibold text-xs tracking-wider uppercase">
            Private Fitting Mirror
          </span>
          <span className="bg-wearer-dark text-parchment text-[10px] px-2 py-0.5 rounded-full font-mono uppercase">
            Wearer-Only Stream
          </span>
        </div>

        {displayResultUrl && (
          <div className="flex items-center gap-1 bg-wearer-dark/60 rounded p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('three-stage')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'three-stage' ? 'bg-white text-wearer font-semibold' : 'text-white/80 hover:text-white'
              }`}
            >
              3-Stage Journey
            </button>
            <button
              type="button"
              onClick={() => setViewMode('result')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'result' ? 'bg-white text-wearer font-semibold' : 'text-white/80 hover:text-white'
              }`}
            >
              Try-On
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'split' ? 'bg-white text-wearer font-semibold' : 'text-white/80 hover:text-white'
              }`}
            >
              Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setViewMode('source')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'source' ? 'bg-white text-wearer font-semibold' : 'text-white/80 hover:text-white'
              }`}
            >
              Original
            </button>
          </div>
        )}
      </div>

      {/* Main mirror display canvas */}
      <div className="relative min-h-[360px] bg-parchment-100 flex flex-col items-center justify-center p-4 overflow-hidden">
        {isProcessing ? (
          <div className="text-center p-8">
            <div className="w-12 h-12 rounded-full border-4 border-wearer border-t-transparent animate-spin mx-auto mb-4" />
            <h4 className="font-serif text-lg font-bold text-ink mb-1">
              Rendering YouCam Try-On...
            </h4>
            <p className="text-xs text-ink-muted max-w-sm">
              YouCam AI Clothes V4 is generating your virtual garment fit. This result will stream directly into your private mirror only.
            </p>
          </div>
        ) : status === 'FAILED' ? (
          <div className="text-center p-8 text-rust space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-rust" />
            <h4 className="font-serif font-bold text-sm text-ink">YouCam Try-On Unsuccessful</h4>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              {failureMessage || 'The garment could not be fitted by YouCam Clothes V4. Try proposing another garment photo.'}
            </p>
          </div>
        ) : !displayResultUrl ? (
          <div className="text-center p-8 text-ink-muted">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-stone-dark opacity-60" />
            <p className="text-xs">No try-on generated yet. Click "Request Virtual Try-On" below to render.</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center space-y-4">
            {/* View Mode: Three-Stage Journey (Wearer Photo -> Garment Candidate -> YouCam Result) */}
            {viewMode === 'three-stage' && (
              <div className="w-full space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  {/* Step 1: Wearer Photo */}
                  <div className="text-center bg-white p-2.5 rounded border border-stone shadow-sm">
                    <span className="text-[10px] font-semibold font-mono text-ink-muted uppercase block mb-1">
                      1. Private Wearer Photo
                    </span>
                    {sourceImageUrl ? (
                      <img
                        src={sourceImageUrl}
                        alt="Original private wearer reference"
                        className="rounded h-44 w-full object-contain mx-auto"
                      />
                    ) : (
                      <div className="h-44 bg-stone-light/30 rounded flex items-center justify-center text-[11px] text-ink-muted px-2">
                        Wearer reference loaded (protected)
                      </div>
                    )}
                    <span className="text-[10px] text-wearer font-medium mt-1 block">Wearer-Only View</span>
                  </div>

                  {/* Step 2: Garment Candidate */}
                  <div className="text-center bg-white p-2.5 rounded border border-stone shadow-sm relative">
                    <span className="text-[10px] font-semibold font-mono text-ink-muted uppercase block mb-1">
                      2. Garment Candidate
                    </span>
                    {garmentPreviewUrl ? (
                      <img
                        src={garmentPreviewUrl}
                        alt="Proposed garment product"
                        className="rounded h-44 w-full object-contain mx-auto"
                      />
                    ) : (
                      <div className="h-44 bg-stone-light/30 rounded flex items-center justify-center text-[11px] text-ink-muted px-2">
                        Product photo
                      </div>
                    )}
                    <span className="text-[10px] text-helper font-medium mt-1 block">Curated by Helper</span>
                  </div>

                  {/* Step 3: YouCam Result */}
                  <div className="text-center bg-white p-2.5 rounded border-2 border-wearer shadow-sm">
                    <span className="text-[10px] font-semibold font-mono text-wearer uppercase block mb-1">
                      3. YouCam VTO Result
                    </span>
                    <img
                      src={displayResultUrl}
                      alt={`Private virtual try-on result for ${displayTitle}`}
                      className="rounded h-44 w-full object-contain mx-auto"
                    />
                    <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">Neural Try-On Render</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-[11px] text-ink-muted font-mono">
                  <span>Wearer Photo</span>
                  <ArrowRight className="w-3.5 h-3.5 text-stone-dark" />
                  <span>Garment Candidate</span>
                  <ArrowRight className="w-3.5 h-3.5 text-stone-dark" />
                  <span className="font-semibold text-wearer">YouCam AI Clothes V4 Result</span>
                </div>
              </div>
            )}

            {/* View Mode: Result only */}
            {viewMode === 'result' && (
              <div className="relative max-w-md mx-auto group">
                <img
                  src={displayResultUrl}
                  alt={`Private virtual try-on result for ${displayTitle}`}
                  className={`rounded shadow-md max-h-[460px] w-auto object-contain transition-transform duration-200 ${
                    zoom ? 'scale-125 cursor-zoom-out' : 'cursor-zoom-in'
                  }`}
                  onClick={() => setZoom(!zoom)}
                />
              </div>
            )}

            {/* View Mode: Side by side */}
            {viewMode === 'split' && (
              <div className="grid grid-cols-2 gap-3 w-full max-w-2xl">
                <div className="text-center bg-white p-2 rounded border border-stone">
                  <span className="text-[11px] font-semibold text-ink-muted uppercase block mb-1">
                    Original Reference
                  </span>
                  {sourceImageUrl ? (
                    <img
                      src={sourceImageUrl}
                      alt="Original private reference photo"
                      className="rounded shadow max-h-[400px] w-auto mx-auto object-contain"
                    />
                  ) : (
                    <div className="h-48 bg-stone-light/40 rounded flex items-center justify-center text-xs text-ink-muted">
                      Source photo protected
                    </div>
                  )}
                </div>
                <div className="text-center bg-white p-2 rounded border border-stone">
                  <span className="text-[11px] font-semibold text-wearer uppercase block mb-1">
                    Virtual Try-On
                  </span>
                  <img
                    src={displayResultUrl}
                    alt={`Private try-on result for ${displayTitle}`}
                    className="rounded shadow max-h-[400px] w-auto mx-auto object-contain"
                  />
                </div>
              </div>
            )}

            {/* View Mode: Source only */}
            {viewMode === 'source' && (
              <div className="relative max-w-md mx-auto">
                {sourceImageUrl ? (
                  <img
                    src={sourceImageUrl}
                    alt="Original private reference photo"
                    className="rounded shadow-md max-h-[460px] w-auto object-contain"
                  />
                ) : (
                  <div className="p-8 text-center text-xs text-ink-muted">
                    Source photo loaded in session
                  </div>
                )}
              </div>
            )}

            {/* YouCam Clothes V4 Attribute & Explanation Card */}
            <div className="w-full max-w-2xl bg-white p-3 rounded-lg border border-stone/80 text-xs space-y-1.5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-stone/30 pb-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-ink">
                  <Sparkles className="w-3.5 h-3.5 text-wearer" />
                  <span>Powered by YouCam AI Clothes V4</span>
                </div>
                <span className="text-[10px] font-mono bg-stone-light/60 px-2 py-0.5 rounded text-ink-muted self-start sm:self-auto">
                  API: /s2s/v2.0/task/cloth-v4
                </span>
              </div>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                YouCam AI Clothes V4 performs neural garment fitting, transferring the candidate piece onto the wearer reference photo while adapting to body contours, pose, and natural lighting.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory Disclaimer Watermark Footer */}
      <div className="bg-parchment-200/80 border-t border-stone px-4 py-2 flex items-center gap-2 text-ink-muted">
        <ShieldAlert className="w-4 h-4 text-rust flex-shrink-0" />
        <p className="text-[10px] leading-tight font-medium tracking-tight">
          <strong className="text-ink">VISUAL APPEARANCE PREVIEW ONLY</strong> — Virtual try-on simulation by YouCam AI Clothes V4. Not an exact guarantee of physical garment sizing, tailor fit, drape, or fabric tension.
        </p>
      </div>
    </div>
  );
};
