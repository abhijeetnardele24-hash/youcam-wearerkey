import React from 'react';
import { Eye, EyeOff, Cpu, Lock } from 'lucide-react';

interface VisibilityRailProps {
  currentStage?: 'consent' | 'upload' | 'proposal' | 'generating' | 'review' | 'decision';
  compact?: boolean;
  role?: 'wearer' | 'helper';
  giftMode?: boolean;
}

export const VisibilityRail: React.FC<VisibilityRailProps> = ({
  compact = false,
  role: _role,
  giftMode: _giftMode = false,
}) => {
  return (
    <div className={`parcel-border rounded-lg bg-white overflow-hidden ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between pb-3 border-b border-stone-light">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-wearer" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
            Cryptographic Visibility Rail
          </h3>
        </div>
        <span className="text-[11px] text-ink-subtle">Server-Enforced Separation</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
        {/* Tier 1: Wearer Only */}
        <div className="rounded p-2.5 bg-wearer-light/50 border border-wearer-border/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-wearer font-semibold mb-1">
              <Eye className="w-3.5 h-3.5" />
              <span>Wearer Only</span>
            </div>
            <ul className="text-ink-muted space-y-1 text-[11px]">
              <li className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-wearer" />
                Raw full-body reference photo
              </li>
              <li className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-wearer" />
                Full virtual try-on private mirror
              </li>
              <li className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-wearer" />
                Private thoughts & final decisions
              </li>
            </ul>
          </div>
          <div className="mt-2 pt-2 border-t border-wearer-border/20 text-[10px] text-wearer font-medium">
            🔒 Kept strictly inside wearer browser
          </div>
        </div>

        {/* Tier 2: Helper Can See */}
        <div className="rounded p-2.5 bg-helper-light/50 border border-helper-border/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-helper font-semibold mb-1">
              <EyeOff className="w-3.5 h-3.5" />
              <span>Helper Can See</span>
            </div>
            <ul className="text-ink-muted space-y-1 text-[11px]">
              <li className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-helper" />
                Permitted categories & remaining budget
              </li>
              <li className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-helper" />
                Their own uploaded garment cards
              </li>
              <li className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-helper" />
                Approve / Maybe / Pass + safe feedback note
              </li>
            </ul>
          </div>
          <div className="mt-2 pt-2 border-t border-helper-border/20 text-[10px] text-helper font-medium">
            🚫 ZERO access to wearer's photo or try-on render
          </div>
        </div>

        {/* Tier 3: Provider Processing */}
        <div className="rounded p-2.5 bg-stone-light/30 border border-stone flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-rust font-semibold mb-1">
              <Cpu className="w-3.5 h-3.5" />
              <span>YouCam Clothes V4</span>
            </div>
            <ul className="text-ink-muted space-y-1 text-[11px]">
              <li className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-rust" />
                Ephemeral server-to-server task
              </li>
              <li className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-rust" />
                Temporary file ID auto-purged
              </li>
              <li className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-rust" />
                Proxied directly to wearer stream
              </li>
            </ul>
          </div>
          <div className="mt-2 pt-2 border-t border-stone text-[10px] text-rust font-medium">
            ⚡ In-memory sanitized, immediate purge
          </div>
        </div>
      </div>
    </div>
  );
};
