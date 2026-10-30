import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { ConsentSeal } from '../components/ConsentSeal';
import { PrivateMirror } from '../components/PrivateMirror';
import { DecisionSlip } from '../components/DecisionSlip';
import { VisibilityRail } from '../components/VisibilityRail';
import type { Decision } from '@wearerkey/contracts';
import {
  Share2,
  Copy,
  Check,
  ShieldAlert,
  FileText,
  Lock,
  Sparkles,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

export const WearerRoomPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [copiedLink, setCopiedLink] = useState(false);
  const [helperUrl, setHelperUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: session,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['wearer-session', token],
    queryFn: () => api.getWearerSession(token!),
    enabled: !!token,
    refetchInterval: 3000,
  });

  const generateHelperLinkMutation = useMutation({
    mutationFn: () => api.createHelperLink(token!),
    onSuccess: (data) => {
      setHelperUrl(data.helper_url);
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Failed to generate helper link.');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => api.revokeSession(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wearer-session', token] });
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Failed to revoke session.');
    },
  });

  const handleCopyLink = () => {
    if (helperUrl) {
      navigator.clipboard.writeText(helperUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleDecide = async (proposalId: string, decision: Decision, note?: string) => {
    if (!token) return;
    await api.decideProposal(token, proposalId, { decision, note });
    queryClient.invalidateQueries({ queryKey: ['wearer-session', token] });
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 rounded-full border-4 border-wearer border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-sm font-serif font-bold text-ink">Opening Private Wearer Room...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-12 h-12 text-rust mx-auto mb-3" />
        <h2 className="font-serif text-xl font-bold text-ink mb-2">Invalid or Expired Pass</h2>
        <p className="text-xs text-ink-muted mb-6">
          This capability token could not be verified or has been revoked.
        </p>
        <Link
          to="/create"
          className="inline-block px-4 py-2 bg-wearer text-white text-xs font-semibold rounded"
        >
          Create New Pass
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone">
        <div>
          <div className="flex items-center gap-2 text-wearer font-bold text-xs uppercase tracking-wider mb-1">
            <Lock className="w-4 h-4" />
            <span>Private Wearer Room</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
            Your Try-On Control Room
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Your reference photo and virtual try-ons are visible only on this screen.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/receipt/${token}`}
            className="px-3 py-1.5 rounded border border-stone bg-white hover:bg-stone-light/40 text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-ink-subtle" />
            <span>Audit Receipt</span>
          </Link>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 rounded border border-stone bg-white hover:bg-stone-light/40 text-ink transition-colors"
            title="Refresh session"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded bg-rust-light border border-rust text-rust text-xs font-medium">
          {actionError}
        </div>
      )}

      {/* Visibility Rail */}
      <VisibilityRail currentStage="review" />

      {/* Active Consent Seal */}
      <ConsentSeal
        categories={session.allowed_categories}
        maxProposals={session.max_proposals}
        proposalsUsed={session.proposals_count}
        expiresAt={session.expires_at}
        status={session.status}
        isWearer={true}
        onRevoke={() => {
          if (
            window.confirm(
              'Are you sure you want to revoke this pass? This will purge all active session data.'
            )
          ) {
            revokeMutation.mutate();
          }
        }}
      />

      {/* Helper Share Box */}
      {session.status === 'ACTIVE' && (
        <div className="parcel-card p-5 bg-helper-light/40 border-2 border-helper-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-helper font-bold text-xs uppercase tracking-wider mb-1">
                <Share2 className="w-4 h-4" />
                <span>Invite Your Helper or Stylist</span>
              </div>
              <p className="text-xs text-ink-muted max-w-lg">
                Share this link with a friend, partner, or stylist. They can propose garments
                matching your rules, but will <strong>never see your photo</strong>.
              </p>
            </div>

            {!helperUrl ? (
              <button
                type="button"
                onClick={() => generateHelperLinkMutation.mutate()}
                disabled={generateHelperLinkMutation.isPending}
                className="px-4 py-2.5 bg-helper hover:bg-helper-dark text-white rounded text-xs font-semibold transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {generateHelperLinkMutation.isPending
                    ? 'Minting Link...'
                    : 'Generate Helper Link'}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                <input
                  type="text"
                  readOnly
                  value={helperUrl}
                  className="px-3 py-1.5 text-xs rounded border border-stone bg-white font-mono flex-1 sm:w-64 select-all text-ink"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-helper hover:bg-helper-dark text-white rounded text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Proposals Stream */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-ink">
            Garment Proposals ({session.proposals.length})
          </h2>
          <span className="text-xs text-ink-subtle">
            {session.proposals_count} of {session.max_proposals} proposed
          </span>
        </div>

        {session.proposals.length === 0 ? (
          <div className="parcel-card p-10 text-center bg-white border border-stone">
            <Sparkles className="w-8 h-8 text-stone-dark mx-auto mb-2 opacity-60" />
            <h3 className="font-serif text-base font-bold text-ink mb-1">
              No Proposals Yet
            </h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto mb-4">
              Share the helper link above with your shopping companion to start receiving outfit
              suggestions.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {session.proposals.map((proposal) => {
              const hasResult = proposal.has_result && !!proposal.result_stream_url;
              const isProcessing =
                proposal.status === 'PROCESSING' || proposal.status === 'SUBMITTED';

              return (
                <div
                  key={proposal.id}
                  className="parcel-card p-5 sm:p-6 bg-white border-2 border-stone space-y-6"
                >
                  {/* Proposal Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-light">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="seal-badge seal-helper capitalize text-[10px]">
                          {proposal.garment_category.replace('_', ' ')}
                        </span>
                        <h3 className="font-serif font-bold text-base text-ink">
                          {proposal.label}
                        </h3>
                      </div>
                      {proposal.brand && (
                        <p className="text-xs text-ink-muted italic mt-1">
                          Brand: {proposal.brand}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-ink-subtle">
                      Status: <strong className="text-ink">{proposal.status}</strong>
                    </span>
                  </div>

                  {/* Two column: Garment Info & Private Mirror */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* Left: Garment proposed */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
                        Proposed Garment
                      </span>
                      <div className="parcel-border rounded bg-parchment-100 p-2 text-center">
                        {proposal.garment_preview_url ? (
                          <img
                            src={proposal.garment_preview_url}
                            alt={proposal.label}
                            className="max-h-64 mx-auto rounded object-contain"
                          />
                        ) : (
                          <div className="h-44 flex items-center justify-center text-xs text-ink-muted">
                            Garment preview attached
                          </div>
                        )}
                      </div>
                      {proposal.product_url && (
                        <a
                          href={proposal.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-wearer hover:underline font-medium"
                        >
                          <span>View Product Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* Right: Private Mirror */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-wearer block">
                        Private Fitting Result (YouCam Clothes V4)
                      </span>
                      <PrivateMirror
                        resultImageUrl={proposal.result_stream_url || undefined}
                        garmentTitle={proposal.label}
                        isProcessing={isProcessing}
                      />
                    </div>
                  </div>

                  {/* Decision Slip */}
                  {hasResult && (
                    <div className="pt-2">
                      <DecisionSlip
                        proposalId={proposal.id}
                        garmentTitle={proposal.label}
                        currentDecision={proposal.decision}
                        currentNote={proposal.wearer_note}
                        onDecide={(dec, note) => handleDecide(proposal.id, dec, note)}
                        disabled={session.status !== 'ACTIVE'}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
