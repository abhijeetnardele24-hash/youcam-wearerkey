import React from 'react';
import { User, Users, ShieldCheck, Lock, EyeOff, Sparkles, Cpu } from 'lucide-react';

export const BoundaryDiagram: React.FC = () => {
  return (
    <div className="parcel-card p-6 bg-parchment-50 border border-stone">
      <div className="text-center max-w-xl mx-auto mb-6">
        <span className="seal-badge seal-wearer mb-2">Architectural Boundary</span>
        <h3 className="font-serif text-xl font-bold text-ink">
          The WearerKey Role-Separated Shopping Boundary
        </h3>
        <p className="text-xs text-ink-muted mt-1">
          How WearerKey orchestrates YouCam AI Clothes V4 with capability-isolated access, ensuring that the helper never receives the wearer's photo or raw VTO render.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch relative">
        {/* Left: Wearer */}
        <div className="rounded-lg bg-wearer-light/60 border-2 border-wearer p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="seal-badge seal-wearer">Role A</span>
              <Lock className="w-4 h-4 text-wearer" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-5 h-5 text-wearer" />
              <h4 className="font-serif font-bold text-base text-ink">Private Wearer</h4>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed mb-3">
              Uploads reference photo & defines immutable Consent Policy (categories, cap, expiry).
            </p>
            <div className="bg-white rounded p-2.5 border border-wearer-border/40 text-[11px] space-y-1">
              <div className="text-wearer font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Private Fitting Mirror
              </div>
              <div className="text-ink-muted">
                Streams virtual try-on render directly. Holds sole power to Approve, Maybe, or Pass.
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-wearer-border/30 text-[11px] font-mono text-wearer font-medium">
            Authorization: Wearer Key
          </div>
        </div>

        {/* Center: Server Gateway & YouCam */}
        <div className="rounded-lg bg-white border-2 border-dashed border-stone p-4 flex flex-col justify-between relative shadow-sm">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stone-light text-ink text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-stone">
            Backend Boundary
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="seal-badge seal-neutral">Enforcer</span>
              <Cpu className="w-4 h-4 text-rust" />
            </div>
            <h4 className="font-serif font-bold text-base text-ink mb-1">
              Consent Gate & YouCam V4
            </h4>
            <p className="text-xs text-ink-muted mb-3">
              Server-enforced policy boundary, in-memory Sharp sanitization, and ephemeral provider tasks.
            </p>
            <div className="bg-parchment-100 rounded p-2.5 border border-stone/50 text-[11px] space-y-1.5 font-mono">
              <div className="text-ink font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-rust" />
                YouCam Clothes V4
              </div>
              <div className="text-ink-muted text-[10px]">
                1. Sanitizes EXIF & size in-memory<br />
                2. Posts ephemeral S2S task<br />
                3. Relays result solely to Wearer<br />
                4. Requests provider file deletion
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-light text-[11px] font-mono text-rust font-medium">
            Zero Storage of Raw Photos
          </div>
        </div>

        {/* Right: Helper */}
        <div className="rounded-lg bg-helper-light/60 border-2 border-helper p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="seal-badge seal-helper">Role B</span>
              <EyeOff className="w-4 h-4 text-helper" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-helper" />
              <h4 className="font-serif font-bold text-base text-ink">Helper / Stylist</h4>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed mb-3">
              Discovers & uploads garment ideas matching the wearer's permitted categories.
            </p>
            <div className="bg-white rounded p-2.5 border border-helper-border/40 text-[11px] space-y-1">
              <div className="text-helper font-semibold flex items-center gap-1">
                <EyeOff className="w-3.5 h-3.5" />
                Zero Photo Access
              </div>
              <div className="text-ink-muted">
                Cannot access or download wearer photos or try-on renders. Receives only the Wearer's verdict slip & note.
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-helper-border/30 text-[11px] font-mono text-helper font-medium">
            Authorization: Helper Key
          </div>
        </div>
      </div>
    </div>
  );
};
