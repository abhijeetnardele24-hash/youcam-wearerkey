import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { ConsentSeal } from '../components/ConsentSeal';
import { VisibilityRail } from '../components/VisibilityRail';
import type { GarmentCategory } from '@wearerkey/contracts';
import {
  EyeOff,
  Plus,
  Upload,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  XCircle,
  FileText,
  ExternalLink,
  ShieldCheck,
  Send,
  RefreshCw,
} from 'lucide-react';

export const HelperRoomPage: React.FC = () => {
  const { token: routeToken } = useParams<{ token: string }>();
  const queryClient = useQueryClient();

  const [token] = useState<string>(() => {
    if (routeToken) {
      try {
        sessionStorage.setItem('wearerkey_helper_token', routeToken);
      } catch {}
      return routeToken;
    }
    try {
      return sessionStorage.getItem('wearerkey_helper_token') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (routeToken && window.history.replaceState) {
      window.history.replaceState(null, '', '/helper');
    }
  }, [routeToken]);

  // Form states
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<GarmentCategory | ''>('');
  const [productUrl, setProductUrl] = useState('');
  const [brand, setBrand] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: session,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['helper-session', token],
    queryFn: () => api.getHelperSession(token!),
    enabled: !!token,
    refetchInterval: 3000,
  });

  const generateTryOnMutation = useMutation({
    mutationFn: (proposalId: string) => api.generateTryOn(token!, proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-session', token] });
    },
    onError: (err: any) => {
      setFormError(err?.message || 'Failed to trigger try-on generation.');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setFormError(null);
    }
  };

  const handleUseSampleGarment = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FAF7F2';
      ctx.fillRect(0, 0, 500, 500);

      // Stylized garment coat/blazer
      ctx.fillStyle = '#70465E';
      ctx.beginPath();
      ctx.moveTo(150, 100);
      ctx.lineTo(350, 100);
      ctx.lineTo(420, 200);
      ctx.lineTo(370, 240);
      ctx.lineTo(340, 180);
      ctx.lineTo(350, 420);
      ctx.lineTo(150, 420);
      ctx.lineTo(160, 180);
      ctx.lineTo(130, 240);
      ctx.lineTo(80, 200);
      ctx.closePath();
      ctx.fill();

      // Collar lapels
      ctx.fillStyle = '#4F3142';
      ctx.beginPath();
      ctx.moveTo(250, 100);
      ctx.lineTo(210, 230);
      ctx.lineTo(250, 250);
      ctx.lineTo(290, 230);
      ctx.closePath();
      ctx.fill();

      // Label text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sample Wool Overcoat', 250, 340);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'sample-garment-overcoat.png', { type: 'image/png' });
          setSelectedFile(file);
          setFilePreview(URL.createObjectURL(file));
          setLabel('Tailored Autumn Wool Overcoat');
          if (session?.allowed_categories.length) {
            setCategory(session.allowed_categories[0]);
          }
          setBrand('Nordic Atelier');
          setFormError(null);
        }
      }, 'image/png');
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !session) return;
    if (!label.trim()) {
      setFormError('Please enter a garment title.');
      return;
    }
    const targetCategory = category || session.allowed_categories[0];
    if (!selectedFile) {
      setFormError('Please upload a garment image or click "Use Sample Garment".');
      return;
    }

    setIsCreating(true);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append('label', label.trim());
      formData.append('garment_category', targetCategory);
      if (productUrl.trim()) formData.append('product_url', productUrl.trim());
      if (brand.trim()) formData.append('brand', brand.trim());
      formData.append('garmentImage', selectedFile);

      await api.createHelperProposal(token, formData);

      // Reset form
      setLabel('');
      setCategory('');
      setProductUrl('');
      setBrand('');
      setSelectedFile(null);
      setFilePreview(null);
      queryClient.invalidateQueries({ queryKey: ['helper-session', token] });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to submit garment proposal.');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 rounded-full border-4 border-helper border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-sm font-serif font-bold text-ink">Connecting to Helper Workspace...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <EyeOff className="w-12 h-12 text-rust mx-auto mb-3" />
        <h2 className="font-serif text-xl font-bold text-ink mb-2">Invalid or Expired Helper Pass</h2>
        <p className="text-xs text-ink-muted mb-6">
          This helper link is either invalid, revoked by the wearer, or past its expiration window.
        </p>
      </div>
    );
  }

  const remainingBudget = session.proposals_remaining;
  const canPropose = session.status === 'ACTIVE' && remainingBudget > 0;
  const proposalsUsed = session.max_proposals - session.proposals_remaining;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone">
        <div>
          <div className="flex items-center gap-2 text-helper font-bold text-xs uppercase tracking-wider mb-1">
            <EyeOff className="w-4 h-4" />
            <span>Helper / Stylist Workspace</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
            Propose Outfits for the Wearer
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Suggest garments within permitted categories. You will receive their feedback without
            seeing their body photo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/receipt/${token}`}
            className="px-3 py-1.5 rounded border border-stone bg-white hover:bg-stone-light/40 text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-ink-subtle" />
            <span>Redacted Receipt</span>
          </Link>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 rounded border border-stone bg-white hover:bg-stone-light/40 text-ink transition-colors"
            title="Refresh session"
            aria-label="Refresh session"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Strict Role-Separated Privacy Notice */}
      <div className="parcel-card p-4 bg-helper-light/40 border-2 border-helper-border/40 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-helper flex-shrink-0 mt-0.5" />
        <div className="text-xs text-ink-muted">
          <strong className="text-ink">Server-Enforced Privacy Boundary:</strong> As a helper, you have no
          access to the wearer's reference photo or virtual try-on render. When you click "Request
          Try-On", YouCam AI Clothes V4 renders the outfit directly to the wearer's private mirror.
          You will receive only their verdict (Approve / Maybe / Pass) and safe feedback note.
        </div>
      </div>

      {/* Visibility Rail */}
      <VisibilityRail currentStage="proposal" />

      {/* Consent Seal */}
      <ConsentSeal
        categories={session.allowed_categories}
        maxProposals={session.max_proposals}
        proposalsUsed={proposalsUsed}
        expiresAt={session.expires_at}
        status={session.status}
        isWearer={false}
      />

      {formError && (
        <div className="p-3 rounded bg-rust-light border border-rust text-rust text-xs font-medium">
          {formError}
        </div>
      )}

      {/* Proposal Creation Card */}
      {canPropose && (
        <div className="parcel-card p-6 bg-white border-2 border-stone">
          <div className="flex items-center justify-between pb-3 border-b border-stone-light mb-4">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-helper" />
              <h3 className="font-serif font-bold text-base text-ink">
                Propose a Garment ({remainingBudget} remaining)
              </h3>
            </div>
            <button
              type="button"
              onClick={handleUseSampleGarment}
              className="text-xs text-helper hover:underline flex items-center gap-1 font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Use Sample Garment</span>
            </button>
          </div>

          <form onSubmit={handleCreateProposal} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="garment-title"
                  className="block text-xs font-bold text-ink uppercase tracking-wider mb-1"
                >
                  Garment Name / Title *
                </label>
                <input
                  id="garment-title"
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Linen Camp Collar Shirt"
                  className="w-full px-3 py-2 text-xs rounded border border-stone bg-white text-ink"
                />
              </div>

              <div>
                <label
                  htmlFor="garment-cat"
                  className="block text-xs font-bold text-ink uppercase tracking-wider mb-1"
                >
                  Permitted Category *
                </label>
                <select
                  id="garment-cat"
                  value={category || session.allowed_categories[0]}
                  onChange={(e) => setCategory(e.target.value as GarmentCategory)}
                  className="w-full px-3 py-2 text-xs rounded border border-stone bg-white text-ink capitalize"
                >
                  {session.allowed_categories.map((c) => (
                    <option key={c} value={c}>
                      {c.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="retailer-url"
                  className="block text-xs font-bold text-ink uppercase tracking-wider mb-1"
                >
                  Store / Retailer Link <span className="font-normal text-ink-subtle">(optional)</span>
                </label>
                <input
                  id="retailer-url"
                  type="url"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://example.com/product/123"
                  className="w-full px-3 py-2 text-xs rounded border border-stone bg-white text-ink"
                />
              </div>

              <div>
                <label
                  htmlFor="brand"
                  className="block text-xs font-bold text-ink uppercase tracking-wider mb-1"
                >
                  Brand Name <span className="font-normal text-ink-subtle">(optional)</span>
                </label>
                <input
                  id="brand"
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Everlane, Arket"
                  maxLength={100}
                  className="w-full px-3 py-2 text-xs rounded border border-stone bg-white text-ink"
                />
              </div>
            </div>

            {/* Garment Image Upload */}
            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                Garment Product Photo *
              </label>
              <div className="parcel-border rounded p-4 bg-parchment-100 text-center border-dashed">
                {filePreview ? (
                  <div className="space-y-2">
                    <img
                      src={filePreview}
                      alt="Garment preview"
                      className="h-36 mx-auto rounded object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                      }}
                      className="text-[11px] text-rust hover:underline"
                    >
                      Change image
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-6 h-6 mx-auto mb-1 text-stone-dark" />
                    <p className="text-xs font-semibold text-ink mb-2">
                      Upload garment image on clean background
                    </p>
                    <label className="inline-flex items-center px-3 py-1.5 bg-white text-ink border border-stone rounded text-xs font-semibold cursor-pointer hover:bg-stone-light/40 transition-colors">
                      <span>Choose File</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreating || !selectedFile || !label.trim()}
              className="w-full py-3 bg-helper hover:bg-helper-dark text-white rounded text-xs font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 shadow-sm"
            >
              {isCreating ? (
                <span>Submitting Proposal...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Garment Proposal</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Proposals Tracking Stream */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-ink">
          Your Submitted Proposals ({session.proposals.length})
        </h2>

        {session.proposals.length === 0 ? (
          <div className="parcel-card p-8 text-center bg-white border border-stone">
            <p className="text-xs text-ink-muted">
              You haven't proposed any garments yet. Use the form above to suggest an outfit!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {session.proposals.map((proposal) => {
              const isGenerating =
                proposal.status === 'PROCESSING' || proposal.status === 'SUBMITTED';
              const isReviewed = proposal.status === 'REVIEWED' && proposal.decision;

              return (
                <div
                  key={proposal.id}
                  className="parcel-card p-5 bg-white border-2 border-stone flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="seal-badge seal-helper capitalize text-[10px] mb-1">
                          {proposal.garment_category.replace('_', ' ')}
                        </span>
                        <h4 className="font-serif font-bold text-base text-ink">
                          {proposal.label}
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono text-ink-subtle">
                        {proposal.status}
                      </span>
                    </div>

                    <div className="parcel-border rounded bg-parchment-100 p-2 text-center mb-3">
                      {proposal.garment_preview_url ? (
                        <img
                          src={proposal.garment_preview_url}
                          alt={proposal.label}
                          className="h-44 mx-auto rounded object-contain"
                        />
                      ) : (
                        <div className="h-44 flex items-center justify-center text-xs text-ink-muted">
                          Garment preview uploaded
                        </div>
                      )}
                    </div>

                    {proposal.product_url && (
                      <a
                        href={proposal.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-helper hover:underline font-medium mb-2"
                      >
                        <span>Retailer Store Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Status / Decision Feedback Slip */}
                  <div className="pt-3 border-t border-stone-light">
                    {proposal.status === 'READY' ? (
                      <button
                        type="button"
                        onClick={() => generateTryOnMutation.mutate(proposal.id)}
                        disabled={generateTryOnMutation.isPending}
                        className="w-full py-2 bg-rust hover:bg-rust-dark text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Request YouCam Clothes V4 Try-On</span>
                      </button>
                    ) : isGenerating ? (
                      <div className="p-3 rounded bg-parchment-100 border border-stone text-center space-y-1">
                        <div className="w-4 h-4 rounded-full border-2 border-rust border-t-transparent animate-spin mx-auto" />
                        <div className="text-xs font-semibold text-ink">
                          YouCam Clothes V4 Rendering...
                        </div>
                        <div className="text-[11px] text-ink-subtle">
                          Result goes directly to wearer's mirror.
                        </div>
                      </div>
                    ) : proposal.status === 'SUCCEEDED' && !isReviewed ? (
                      <div className="p-3 rounded bg-amber-50 border border-amber-200 text-center">
                        <div className="text-xs font-semibold text-amber-900">
                          Waiting for Wearer Review
                        </div>
                        <div className="text-[11px] text-amber-800">
                          Rendered in wearer's private mirror.
                        </div>
                      </div>
                    ) : isReviewed ? (
                      <div
                        className={`p-3 rounded border text-left ${
                          proposal.decision === 'APPROVE'
                            ? 'bg-success-light/60 border-success text-success-dark'
                            : proposal.decision === 'MAYBE'
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-rust-light/60 border-rust text-rust-dark'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs uppercase mb-1">
                          {proposal.decision === 'APPROVE' && (
                            <CheckCircle2 className="w-4 h-4 text-success" />
                          )}
                          {proposal.decision === 'MAYBE' && (
                            <HelpCircle className="w-4 h-4 text-amber-700" />
                          )}
                          {proposal.decision === 'PASS' && (
                            <XCircle className="w-4 h-4 text-rust" />
                          )}
                          <span>Wearer Decision: {proposal.decision}</span>
                        </div>
                        {proposal.wearer_note && (
                          <p className="text-xs italic mt-1 bg-white/70 p-2 rounded border border-black/5 text-ink">
                            "{proposal.wearer_note}"
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
