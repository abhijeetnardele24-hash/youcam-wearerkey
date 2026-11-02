import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  User,
  AlertTriangle,
  X
} from 'lucide-react';

export const WearerRoomPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [copiedLink, setCopiedLink] = useState(false);
  const [helperUrl, setHelperUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [showSourcePhoto, setShowSourcePhoto] = useState(false);

  // Single-use capability token: read strictly from URL fragment without storing in sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      let code = '';
      if (hash.startsWith('#bootstrap=')) {
        code = hash.substring(11);
      } else if (hash.startsWith('#token=')) {
        code = hash.substring(7);
      }
      if (code) {
        // Immediately remove capability code from browser address bar
        if (window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        api.bootstrap(code, 'wearer')
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['wearer-session'] });
          })
          .catch((err: any) => {
            if (err?.statusCode === 409 || err?.error === 'BOOTSTRAP_CODE_ALREADY_USED') {
              setBootstrapError('This capability link has already been redeemed. For your privacy, single-use bootstrap links cannot be replayed.');
            } else {
              setBootstrapError(err?.message || 'Bootstrap authentication failed.');
            }
          });
      }
    }
  }, [queryClient]);

  // Handle ESC key for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRevokeModalOpen) {
        setIsRevokeModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevokeModalOpen]);

  const {
    data: session,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['wearer-session'],
    queryFn: () => api.getWearerSession(),
    refetchInterval: 3000,
  });

  // Real-time server-sent events with background polling fallback (connects once session is authenticated)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.EventSource || !session) return;

    const eventSource = new EventSource('/api/wearer/events', { withCredentials: true });

    eventSource.addEventListener('PROPOSAL_CREATED', () => {
      queryClient.invalidateQueries({ queryKey: ['wearer-session'] });
    });
    eventSource.addEventListener('TRYON_COMPLETED', () => {
      queryClient.invalidateQueries({ queryKey: ['wearer-session'] });
    });
    eventSource.addEventListener('DECISION_RECORDED', () => {
      queryClient.invalidateQueries({ queryKey: ['wearer-session'] });
    });
    eventSource.addEventListener('SESSION_REVOKED', () => {
      queryClient.invalidateQueries({ queryKey: ['wearer-session'] });
    });
    eventSource.addEventListener('SESSION_EXPIRED', () => {
      queryClient.invalidateQueries({ queryKey: ['wearer-session'] });
    });

    return () => {
      eventSource.close();
    };
  }, [queryClient, !!session]);

  const generateHelperLinkMutation = useMutation({
    mutationFn: () => api.createHelperLink(),
    onSuccess: (data) => {
      setHelperUrl(data.helper_url);
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Failed to generate helper link.');
    },
  });

  const retryPurgeMutation = useMutation({
    mutationFn: () => api.retryPurge(),
    onSuccess: () => {
      setActionError(null);
      refetch();
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Purge retry failed.');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => api.revokeSession(),
    onSuccess: () => {
      setIsRevokeModalOpen(false);
      refetch();
    },
    onError: (err: any) => {
      setIsRevokeModalOpen(false);
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
    await api.decideProposal(proposalId, { decision, note });
    queryClient.invalidateQueries({ queryKey: ['wearer-session'] });
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 rounded-full border-4 border-wearer border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-sm font-serif font-bold text-ink">Opening Private Wearer Room...</p>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-12 h-12 text-rust mx-auto mb-3" />
        <h2 className="font-serif text-xl font-bold text-ink mb-2">Capability Link Redeemed</h2>
        <p className="text-xs text-ink-muted mb-6 leading-relaxed">
          {bootstrapError}
        </p>
        <Link
          to="/create"
          className="inline-block px-4 py-2 bg-wearer text-white text-xs font-semibold rounded hover:bg-wearer-dark transition-colors"
        >
          Create New Pass
        </Link>
      </div>
    );
  }

  if (error || !session) {
    const isRevokedError =
      (error as any)?.statusCode === 410 ||
      (error as any)?.error === 'SESSION_REVOKED' ||
      (error as any)?.message?.toLowerCase().includes('revoked');

    if (isRevokedError) {
      return (
        <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
          <Lock className="w-12 h-12 text-rust mx-auto mb-2" />
          <h2 className="font-serif text-xl font-bold text-ink mb-1">Pass Revoked — Data Purge Initiated</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            All helper access has been revoked. In-memory reference image buffers have been purged,
            and automated deletion requests have been dispatched to YouCam's File and Task APIs.
          </p>
          <div className="pt-4 flex items-center justify-center gap-3">
            <Link
              to="/receipt"
              className="px-4 py-2 bg-wearer hover:bg-wearer-dark text-white text-xs font-semibold rounded transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Deletion Receipt</span>
            </Link>
            <Link
              to="/create"
              className="px-4 py-2 rounded border border-stone text-xs font-semibold text-ink hover:bg-stone-light/60 transition-colors"
            >
              Create New Pass
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-12 h-12 text-rust mx-auto mb-3" />
        <h2 className="font-serif text-xl font-bold text-ink mb-2">Access Denied or Session Expired</h2>
        <p className="text-xs text-ink-muted mb-6">
          {(error as any)?.message || 'This private room link is invalid, expired, or has been revoked.'}
        </p>
        <Link
          to="/create"
          className="inline-block px-4 py-2 bg-wearer text-white text-xs font-semibold rounded hover:bg-wearer-dark transition-colors"
        >
          Create New Pass
        </Link>
      </div>
    );
  }

  const isRevoked = session.status === 'REVOKED';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-wearer inline-block" />
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
              Wearer Control Room
            </h1>
          </div>
          <p className="text-xs text-ink-muted">
            Private mirror preview • Only you can see your body reference and try-on results
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isRevoked && (
            <button
              type="button"
              onClick={() => setIsRevokeModalOpen(true)}
              className="px-3.5 py-1.5 rounded border border-rust text-rust hover:bg-rust-light text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Revoke Pass & Purge Data</span>
            </button>
          )}
          {isRevoked && (
            <Link
              to="/receipt"
              className="px-3.5 py-1.5 rounded bg-stone-light/60 hover:bg-stone text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Deletion Receipt</span>
            </Link>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded bg-rust-light border border-rust text-rust text-xs font-medium flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Revoked Notice */}
      {isRevoked && (
        <div className="p-4 rounded-lg bg-rust-light/40 border border-rust text-ink space-y-2">
          <div className="flex items-center gap-2 text-rust font-semibold text-sm">
            <Lock className="w-4 h-4" />
            <span>Pass Revoked — Data Purge Initiated</span>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            All helper access has been revoked. In-memory reference image buffers have been purged,
            and automated deletion requests have been dispatched to YouCam's File and Task APIs.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <Link
              to="/receipt"
              className="text-xs font-semibold text-wearer hover:underline flex items-center gap-1"
            >
              <span>Inspect Signed Deletion Receipt</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              type="button"
              onClick={() => retryPurgeMutation.mutate()}
              disabled={retryPurgeMutation.isPending}
              className="text-xs font-semibold text-ink-muted hover:text-ink flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${retryPurgeMutation.isPending ? 'animate-spin' : ''}`} />
              <span>Retry Purge Verification</span>
            </button>
          </div>
        </div>
      )}

      {/* Visibility Rail Component */}
      <VisibilityRail role="wearer" giftMode={session.gift_mode} />

      {/* Main Grid: Consent Seal & Helper Link Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Consent Seal */}
        <div className="md:col-span-1">
          <ConsentSeal
            version={session.consent_version}
            allowedCategories={session.allowed_categories}
            maxProposals={session.max_proposals}
            proposalsRemaining={session.proposals_remaining}
            expiresAt={session.expires_at}
            giftMode={session.gift_mode}
            status={session.status}
          />
        </div>

        {/* Helper Link Sharing Box */}
        <div className="md:col-span-2 parcel-card p-6 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-ink font-serif font-bold text-base">
              <Share2 className="w-4 h-4 text-wearer" />
              <span>Invite Shopping Companion</span>
            </div>
            <span className="text-[11px] font-semibold text-wearer bg-wearer-light px-2 py-0.5 rounded">
              Server-Enforced Separation
            </span>
          </div>

          <p className="text-xs text-ink-muted leading-relaxed">
            Send this single-use capability link to your partner, friend, caregiver, or stylist. They can
            propose garments from online stores matching your permitted categories, but{' '}
            <strong className="text-ink">they will NEVER receive your photo or fitting renders.</strong>
          </p>

          {!helperUrl ? (
            <button
              type="button"
              onClick={() => generateHelperLinkMutation.mutate()}
              disabled={generateHelperLinkMutation.isPending || isRevoked}
              className="px-4 py-2.5 bg-wearer hover:bg-wearer-dark text-white rounded text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {generateHelperLinkMutation.isPending ? 'Generating Safe Link...' : 'Generate Helper Link'}
              </span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  aria-label="Single-use helper invitation link"
                  value={helperUrl}
                  className="flex-1 px-3 py-2 bg-stone-light/30 border border-stone rounded font-mono text-xs text-ink select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-wearer hover:bg-wearer-dark text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-ink-subtle">
                Single-use link. When opened, it binds to that browser and cannot be replayed.
              </p>
            </div>
          )}

          {/* Reference Photo Toggle */}
          <div className="pt-4 border-t border-stone flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-ink-muted">
              <User className="w-3.5 h-3.5" />
              <span>Reference Image Status:</span>
              <span className="font-semibold text-wearer">Secure in-memory</span>
            </div>
            {session.source_image_url && (
              <button
                type="button"
                onClick={() => setShowSourcePhoto(!showSourcePhoto)}
                aria-pressed={showSourcePhoto}
                className="text-wearer hover:underline font-semibold text-xs"
              >
                {showSourcePhoto ? 'Hide My Photo (All Views)' : 'Show My Photo'}
              </button>
            )}
          </div>

          {showSourcePhoto && session.source_image_url && (
            <div className="pt-2">
              <img
                src={session.source_image_url}
                alt="Wearer private reference"
                className="w-32 h-40 object-cover rounded border border-stone shadow-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Proposals & Fitting Mirrors Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-ink">
            Garment Proposals & Private Mirrors
          </h2>
          <span className="text-xs text-ink-muted">
            {session.proposals.length} of {session.max_proposals} proposals received
          </span>
        </div>

        {session.proposals.length === 0 ? (
          <div className="parcel-card p-12 text-center bg-white space-y-3">
            <Sparkles className="w-8 h-8 text-ink-subtle mx-auto" />
            <h3 className="font-serif text-base font-bold text-ink">Awaiting Garment Proposals</h3>
            <p className="text-xs text-ink-muted max-w-md mx-auto leading-relaxed">
              Share the Helper Link above with your shopping companion. When they find an item they
              think will look great on you, their proposal will appear here for your private review.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {session.proposals.map((proposal) => (
              <div key={proposal.id} className="parcel-card p-5 bg-white space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle block">
                      {proposal.garment_category}
                    </span>
                    <h4 className="font-serif text-base font-bold text-ink">{proposal.label}</h4>
                    {proposal.brand && (
                      <p className="text-xs text-ink-muted">Brand: {proposal.brand}</p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                      proposal.status === 'SUCCEEDED'
                        ? 'bg-wearer-light text-wearer'
                        : proposal.status === 'FAILED'
                        ? 'bg-rust-light text-rust'
                        : 'bg-stone-light/60 text-ink-muted'
                    }`}
                  >
                    {proposal.status.toLowerCase()}
                  </span>
                </div>

                {/* Private Mirror Visual */}
                <PrivateMirror
                  resultUrl={proposal.result_stream_url}
                  garmentPreviewUrl={proposal.garment_preview_url}
                  sourceImageUrl={showSourcePhoto ? (session.source_image_url || undefined) : undefined}
                  showSourcePhoto={showSourcePhoto}
                  providerMode={proposal.provider_mode}
                  status={proposal.status}
                  label={proposal.label}
                  failureMessage={proposal.failure_message_safe}
                />

                {/* Decision Slip */}
                <DecisionSlip
                  proposalId={proposal.id}
                  currentDecision={proposal.decision}
                  currentNote={proposal.wearer_note}
                  disabled={isRevoked}
                  onDecide={(dec, note) => handleDecide(proposal.id, dec, note)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revocation Confirmation Modal */}
      {isRevokeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
        >
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl border border-stone">
            <div className="flex items-center gap-3 text-rust">
              <div className="w-10 h-10 rounded-full bg-rust-light flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 id="revoke-modal-title" className="font-serif text-lg font-bold text-ink">
                Revoke Try-On Pass?
              </h3>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              This action is immediate and irrevocable. Helper access will be permanently revoked,
              all in-memory reference images will be purged, and deletion requests will be sent to
              YouCam for all remote files and tasks.
            </p>

            <div className="p-3 bg-stone-light/40 rounded text-[11px] text-ink-muted space-y-1">
              <p className="font-semibold text-ink">Tamper-Evident Ledger Integrity:</p>
              <p>• Helper link becomes invalid immediately (HTTP 410).</p>
              <p>• You will receive an HMAC-SHA256 signed audit receipt recording provider deletion responses.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRevokeModalOpen(false)}
                className="px-4 py-2 rounded text-xs font-semibold text-ink-muted hover:text-ink hover:bg-stone-light/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => revokeMutation.mutate()}
                disabled={revokeMutation.isPending}
                className="px-4 py-2 bg-rust hover:bg-rust-dark text-white rounded text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {revokeMutation.isPending ? 'Purging Data...' : 'Confirm Revoke & Purge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
