import React, { useState } from 'react';
import { Eye, ShieldAlert, Sparkles } from 'lucide-react';

interface PrivateMirrorProps {
  sourceImageUrl?: string;
  resultImageUrl?: string;
  garmentTitle: string;
  isProcessing?: boolean;
}

export const PrivateMirror: React.FC<PrivateMirrorProps> = ({
  sourceImageUrl,
  resultImageUrl,
  garmentTitle,
  isProcessing = false,
}) => {
  const [viewMode, setViewMode] = useState<'result' | 'split' | 'source'>('result');
  const [zoom, setZoom] = useState(false);

  return (
    <div className="parcel-card overflow-hidden bg-white border-2 border-wearer/40">
      {/* Header bar */}
      <div className="bg-wearer text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-parchment" />
          <span className="font-semibold text-xs tracking-wider uppercase">
            Private Fitting Mirror
          </span>
          <span className="bg-wearer-dark text-parchment text-[10px] px-2 py-0.5 rounded-full font-mono uppercase">
            Wearer-Only Stream
          </span>
        </div>

        {resultImageUrl && (
          <div className="flex items-center gap-1 bg-wearer-dark/60 rounded p-0.5 text-xs">
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
      <div className="relative min-h-[360px] max-h-[560px] bg-parchment-100 flex items-center justify-center p-4 overflow-hidden">
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
        ) : !resultImageUrl ? (
          <div className="text-center p-8 text-ink-muted">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-stone-dark opacity-60" />
            <p className="text-xs">No try-on generated yet. Click "Generate Try-On" below to render.</p>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center relative">
            {/* View Mode: Result only */}
            {viewMode === 'result' && (
              <div className="relative max-w-md mx-auto group">
                <img
                  src={resultImageUrl}
                  alt={`Private virtual try-on result for ${garmentTitle}`}
                  className={`rounded shadow-md max-h-[500px] w-auto object-contain transition-transform duration-200 ${
                    zoom ? 'scale-125 cursor-zoom-out' : 'cursor-zoom-in'
                  }`}
                  onClick={() => setZoom(!zoom)}
                />
              </div>
            )}

            {/* View Mode: Side by side */}
            {viewMode === 'split' && (
              <div className="grid grid-cols-2 gap-3 w-full max-w-2xl">
                <div className="text-center">
                  <span className="text-[11px] font-semibold text-ink-muted uppercase block mb-1">
                    Original Reference
                  </span>
                  {sourceImageUrl ? (
                    <img
                      src={sourceImageUrl}
                      alt="Original private reference photo"
                      className="rounded shadow max-h-[440px] w-auto mx-auto object-contain"
                    />
                  ) : (
                    <div className="h-48 bg-stone-light/40 rounded flex items-center justify-center text-xs text-ink-muted">
                      Source photo protected
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <span className="text-[11px] font-semibold text-wearer uppercase block mb-1">
                    Virtual Try-On
                  </span>
                  <img
                    src={resultImageUrl}
                    alt={`Private try-on result for ${garmentTitle}`}
                    className="rounded shadow max-h-[440px] w-auto mx-auto object-contain"
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
                    className="rounded shadow-md max-h-[500px] w-auto object-contain"
                  />
                ) : (
                  <div className="p-8 text-center text-xs text-ink-muted">
                    Source photo loaded in session
                  </div>
                )}
              </div>
            )}
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
