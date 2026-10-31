import React from 'react';
import { ShieldCheck, Clock, Layers, Sparkles } from 'lucide-react';
import type { GarmentCategory, SessionStatus } from '@wearerkey/contracts';

interface ConsentSealProps {
  categories?: GarmentCategory[];
  allowedCategories?: GarmentCategory[];
  maxProposals: number;
  proposalsUsed?: number;
  proposalsRemaining?: number;
  expiresAt: string;
  status: SessionStatus;
  mode?: string;
  version?: string;
  giftMode?: boolean;
  onRevoke?: () => void;
  isWearer?: boolean;
}

export const ConsentSeal: React.FC<ConsentSealProps> = ({
  categories,
  allowedCategories,
  maxProposals,
  proposalsUsed,
  proposalsRemaining,
  expiresAt,
  status,
  mode,
  version: _version,
  giftMode: _giftMode = false,
  onRevoke,
  isWearer = false,
}) => {
  const cats = allowedCategories || categories || [];
  const isExpired = new Date(expiresAt).getTime() < Date.now();
  const remaining = proposalsRemaining !== undefined 
    ? proposalsRemaining 
    : Math.max(0, maxProposals - (proposalsUsed || 0));

  const getStatusBadge = () => {
    if (status === 'REVOKED') {
      return <span className="seal-badge bg-rust-light text-rust border border-rust">Revoked & Purged</span>;
    }
    if (isExpired || status === 'EXPIRED') {
      return <span className="seal-badge bg-stone-light text-ink-muted border border-stone">Expired</span>;
    }
    if (status === 'ACTIVE') {
      return <span className="seal-badge seal-wearer">Active Pass</span>;
    }
    return <span className="seal-badge seal-neutral">{status}</span>;
  };

  return (
    <div className="parcel-card p-4 sm:p-5 relative overflow-hidden border-2 border-stone">
      <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full border border-stone/40 pointer-events-none opacity-40 flex items-center justify-center">
        <div className="w-20 h-20 rounded-full border border-dashed border-stone/60" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-light">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-wearer-light text-wearer flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink uppercase tracking-wide">
              Try-On Pass Consent Seal
            </h4>
            <span className="text-[11px] text-ink-subtle">
              Enforced by Server Consent Gate
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {mode && (
            <span className="text-[10px] text-ink-muted uppercase font-mono px-2 py-0.5 bg-stone-light/50 rounded">
              {mode}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 text-xs">
        <div>
          <span className="text-ink-subtle block mb-1 flex items-center gap-1 font-medium">
            <Layers className="w-3.5 h-3.5 text-stone-dark" />
            Permitted Categories
          </span>
          <div className="flex flex-wrap gap-1">
            {cats.map((c) => (
              <span
                key={c}
                className="px-2 py-0.5 rounded bg-parchment text-ink font-medium capitalize border border-stone/50 text-[11px]"
              >
                {c.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span className="text-ink-subtle block mb-1 flex items-center gap-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-stone-dark" />
            Proposal Budget
          </span>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink text-sm">
              {proposalsUsed !== undefined ? proposalsUsed : (maxProposals - remaining)} / {maxProposals}
            </span>
            <span className="text-[11px] text-ink-muted">
              ({remaining} remaining)
            </span>
          </div>
        </div>

        <div>
          <span className="text-ink-subtle block mb-1 flex items-center gap-1 font-medium">
            <Clock className="w-3.5 h-3.5 text-stone-dark" />
            Valid Until
          </span>
          <span className="text-ink font-medium block">
            {new Date(expiresAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {isWearer && onRevoke && status === 'ACTIVE' && (
        <div className="mt-4 pt-3 border-t border-stone-light flex justify-end">
          <button
            type="button"
            onClick={onRevoke}
            className="text-xs text-rust hover:text-rust-dark font-medium underline transition-colors"
          >
            Revoke Pass & Purge In-Memory Session
          </button>
        </div>
      )}
    </div>
  );
};
