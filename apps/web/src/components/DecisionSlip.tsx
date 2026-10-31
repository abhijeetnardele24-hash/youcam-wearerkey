import React, { useState } from 'react';
import { Check, HelpCircle, X, Send, ShieldCheck } from 'lucide-react';
import type { Decision } from '@wearerkey/contracts';

interface DecisionSlipProps {
  proposalId: string;
  garmentTitle?: string;
  currentDecision?: Decision | null;
  currentNote?: string | null;
  onDecide: (decision: Decision, note?: string) => Promise<void>;
  disabled?: boolean;
}

export const DecisionSlip: React.FC<DecisionSlipProps> = ({
  proposalId,
  garmentTitle = 'Garment',
  currentDecision,
  currentNote,
  onDecide,
  disabled = false,
}) => {
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(currentDecision || null);
  const [note, setNote] = useState<string>(currentNote || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!currentDecision);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDecision) return;

    setIsSubmitting(true);
    try {
      await onDecide(selectedDecision, note.trim() || undefined);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="parcel-card p-5 bg-parchment-50 border-2 border-stone relative">
      <div className="flex items-center justify-between pb-3 border-b border-stone-light">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-wearer" />
          <h4 className="font-serif font-bold text-sm text-ink">
            Wearer Decision Slip
          </h4>
        </div>
        <span className="text-[11px] font-mono text-ink-subtle">
          ID: {proposalId.slice(0, 8)}
        </span>
      </div>

      <div className="mt-3">
        <p className="text-xs text-ink-muted mb-3">
          Cast your private verdict for <strong className="text-ink">{garmentTitle}</strong>. Your helper receives only the selected verdict and safe feedback note.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              disabled={disabled || isSubmitting}
              onClick={() => setSelectedDecision('APPROVE')}
              className={`p-3 rounded border flex flex-col items-center justify-center gap-1.5 transition-colors text-xs font-semibold ${
                selectedDecision === 'APPROVE'
                  ? 'bg-success text-white border-success-dark shadow-sm scale-[1.02]'
                  : 'bg-white text-ink border-stone hover:bg-success-light/30'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                selectedDecision === 'APPROVE' ? 'bg-white text-success' : 'bg-success-light text-success'
              }`}>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span>Approve</span>
              <span className={`text-[10px] font-normal ${
                selectedDecision === 'APPROVE' ? 'text-white font-medium' : 'text-ink-subtle'
              }`}>
                Looks great
              </span>
            </button>

            <button
              type="button"
              disabled={disabled || isSubmitting}
              onClick={() => setSelectedDecision('MAYBE')}
              className={`p-3 rounded border flex flex-col items-center justify-center gap-1.5 transition-colors text-xs font-semibold ${
                selectedDecision === 'MAYBE'
                  ? 'bg-amber-700 text-white border-amber-800 shadow-sm scale-[1.02]'
                  : 'bg-white text-ink border-stone hover:bg-amber-50'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                selectedDecision === 'MAYBE' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-700'
              }`}>
                <HelpCircle className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span>Maybe</span>
              <span className={`text-[10px] font-normal ${
                selectedDecision === 'MAYBE' ? 'text-white font-medium' : 'text-ink-subtle'
              }`}>
                Let's compare
              </span>
            </button>

            <button
              type="button"
              disabled={disabled || isSubmitting}
              onClick={() => setSelectedDecision('PASS')}
              className={`p-3 rounded border flex flex-col items-center justify-center gap-1.5 transition-colors text-xs font-semibold ${
                selectedDecision === 'PASS'
                  ? 'bg-rust text-white border-rust-dark shadow-sm scale-[1.02]'
                  : 'bg-white text-ink border-stone hover:bg-rust-light/30'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                selectedDecision === 'PASS' ? 'bg-white text-rust' : 'bg-rust-light text-rust'
              }`}>
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span>Pass</span>
              <span className={`text-[10px] font-normal ${
                selectedDecision === 'PASS' ? 'text-white font-medium' : 'text-ink-subtle'
              }`}>
                Not for me
              </span>
            </button>
          </div>

          <div>
            <label htmlFor={`note-${proposalId}`} className="block text-xs font-semibold text-ink mb-1">
              Safe Feedback Note <span className="font-normal text-ink-subtle">(visible to helper)</span>
            </label>
            <input
              id={`note-${proposalId}`}
              type="text"
              disabled={disabled || isSubmitting}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Love the collar, but prefer a darker shade or looser fit"
              maxLength={200}
              className="w-full px-3 py-2 text-xs rounded border border-stone bg-white text-ink placeholder:text-ink-subtle/70 focus:border-wearer focus:ring-1 focus:ring-wearer"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-wearer font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Helper will never see your try-on mirror photo</span>
            </div>

            <button
              type="submit"
              disabled={disabled || !selectedDecision || isSubmitting}
              className="px-4 py-2 bg-wearer hover:bg-wearer-dark text-white rounded text-xs font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Transmitting...</span>
              ) : submitted ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Update Verdict</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Verdict</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
