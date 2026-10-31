import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Send,
  RefreshCw,
} from 'lucide-react';

export const HelperRoomPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  // Single-use capability bootstrap: read strictly from URL fragment without storing in sessionStorage
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
        api.bootstrap(code, 'helper')
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['helper-session'] });
          })
          .catch((err: any) => {
            if (err?.statusCode === 409 || err?.error === 'BOOTSTRAP_CODE_ALREADY_USED') {
              setBootstrapError('This capability link has already been redeemed. Single-use bootstrap links cannot be replayed.');
            } else {
              setBootstrapError(err?.message || 'Bootstrap authentication failed.');
            }
          });
      }
    }
  }, [queryClient]);

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
    queryKey: ['helper-session'],
    queryFn: () => api.getHelperSession(),
    refetchInterval: 3000,
  });

  const generateTryOnMutation = useMutation({
    mutationFn: (proposalId: string) => api.generateTryOn(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-session'] });
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
    if (!session) return;
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

      await api.createHelperProposal(formData);

      // Reset form
      setLabel('');
      setCategory('');
      setProductUrl('');
      setBrand('');
      setSelectedFile(null);
      setFilePreview(null);
      queryClient.invalidateQueries({ queryKey: ['helper-session'] });
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

  if (bootstrapError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <EyeOff className="w-12 h-12 text-rust mx-auto mb-3" />
        <h2 className="font-serif text-xl font-bold text-ink mb-2">Capability Link Redeemed</h2>
        <p className="text-xs text-ink-muted mb-6 leading-relaxed">
          {bootstrapError}
        </p>
        <Link
          to="/"
          className="inline-block px-4 py-2 bg-helper text-white text-xs font-semibold rounded hover:bg-helper-dark transition-colors"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <EyeOff className="w-12 h-12 text-rust mx-auto mb-3" />
        <h2 className="font-serif text-xl font-bold text-ink mb-2">Invalid or Expired Helper Pass</h2>
        <p className="text-xs text-ink-muted mb-6">
          {(error as any)?.message || 'This helper room link has expired or the session was revoked.'}
        </p>
        <Link
          to="/"
          className="inline-block px-4 py-2 bg-helper text-white text-xs font-semibold rounded hover:bg-helper-dark transition-colors"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  const isRevoked = session.status === 'REVOKED';
  const proposalsRemaining = session.proposals_remaining;
  const canPropose = !isRevoked && proposalsRemaining > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-helper inline-block" />
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
              Helper Shopping Workspace
            </h1>
          </div>
          <p className="text-xs text-ink-muted">
            Propose styles for the wearer • Wearer body photo and private mirror renders are strictly protected
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/receipt"
            className="px-3.5 py-1.5 rounded bg-stone-light/60 hover:bg-stone text-xs font-semibold text-ink flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Audit Ledger</span>
          </Link>
        </div>
      </div>

      {/* Revoked Notice */}
      {isRevoked && (
        <div className="p-4 rounded-lg bg-rust-light/40 border border-rust text-ink space-y-2">
          <div className="flex items-center gap-2 text-rust font-semibold text-sm">
            <EyeOff className="w-4 h-4" />
            <span>Try-On Pass Revoked by Wearer</span>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            The wearer has ended this shopping collaboration. No further garment proposals can be
            submitted, and all session data has been purged according to the WearerKey privacy protocol.
          </p>
        </div>
      )}

      {/* Visibility Rail Component */}
      <VisibilityRail role="helper" giftMode={session.gift_mode} />

      {/* Consent Seal & Propose Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Consent Seal Info */}
        <div className="md:col-span-1">
          <ConsentSeal
            version="2026-10-30-v1"
            allowedCategories={session.allowed_categories}
            maxProposals={session.max_proposals}
            proposalsRemaining={session.proposals_remaining}
            expiresAt={session.expires_at}
            giftMode={session.gift_mode}
            status={session.status}
          />
        </div>

        {/* Propose Garment Form */}
        <div className="md:col-span-2 parcel-card p-6 bg-white space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-ink font-serif font-bold text-base">
              <Plus className="w-4 h-4 text-helper" />
              <span>Propose a Garment</span>
            </div>
            <span className="text-xs font-mono text-ink-muted">
              {proposalsRemaining} proposal{proposalsRemaining === 1 ? '' : 's'} remaining
            </span>
          </div>

          {canPropose ? (
            <form onSubmit={handleCreateProposal} className="space-y-4">
              {formError && (
                <div className="p-3 rounded bg-rust-light border border-rust text-rust text-xs font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="garment-label" className="block text-xs font-semibold text-ink mb-1">
                    Garment Title *
                  </label>
                  <input
                    id="garment-label"
                    type="text"
                    required
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Wool Peacoat, Linen Blouse"
                    className="w-full px-3 py-2 border border-stone rounded text-xs text-ink focus:outline-none focus:border-helper"
                  />
                </div>

                <div>
                  <label htmlFor="garment-category" className="block text-xs font-semibold text-ink mb-1">
                    Category *
                  </label>
                  <select
                    id="garment-category"
                    value={category || session.allowed_categories[0]}
                    onChange={(e) => setCategory(e.target.value as GarmentCategory)}
                    className="w-full px-3 py-2 border border-stone rounded text-xs text-ink focus:outline-none focus:border-helper bg-white capitalize"
                  >
                    {session.allowed_categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-brand" className="block text-xs font-semibold text-ink mb-1">
                    Brand / Retailer (Optional)
                  </label>
                  <input
                    id="product-brand"
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Everlane, COS, Zara"
                    className="w-full px-3 py-2 border border-stone rounded text-xs text-ink focus:outline-none focus:border-helper"
                  />
                </div>

                <div>
                  <label htmlFor="product-url" className="block text-xs font-semibold text-ink mb-1">
                    Product Page Link (Optional)
                  </label>
                  <input
                    id="product-url"
                    type="url"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-stone rounded text-xs text-ink focus:outline-none focus:border-helper"
                  />
                </div>
              </div>

              {/* Garment Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Garment Product Photo *
                </label>
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <div className="flex-1 w-full">
                    <label
                      htmlFor="garment-file-input"
                      className="border border-dashed border-stone rounded p-4 text-center cursor-pointer hover:bg-stone-light/30 transition-colors block"
                    >
                      <Upload className="w-5 h-5 text-ink-subtle mx-auto mb-1" />
                      <span className="text-xs text-ink-muted block">
                        {selectedFile ? selectedFile.name : 'Upload product JPG or PNG'}
                      </span>
                      <input
                        id="garment-file-input"
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseSampleGarment}
                    className="px-3 py-3 rounded border border-stone bg-stone-light/40 hover:bg-stone text-xs font-semibold text-ink transition-colors whitespace-nowrap w-full sm:w-auto"
                  >
                    Use Sample Garment
                  </button>
                </div>
              </div>

              {filePreview && (
                <div className="flex items-center gap-3 p-2 bg-stone-light/20 rounded border border-stone">
                  <img
                    src={filePreview}
                    alt="Garment preview"
                    className="w-12 h-12 object-cover rounded border border-stone"
                  />
                  <div className="text-xs text-ink-muted">
                    <p className="font-semibold text-ink">{label || 'Garment ready'}</p>
                    <p className="text-[11px]">Ready for virtual drape</p>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full py-2.5 bg-helper hover:bg-helper-dark text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isCreating ? 'Submitting Proposal...' : 'Propose to Wearer'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-6 text-xs text-ink-muted">
              {isRevoked
                ? 'Session has been revoked.'
                : 'Maximum proposal cap reached for this Try-On Pass.'}
            </div>
          )}
        </div>
      </div>

      {/* Submitted Proposals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-ink">
            Submitted Garments & Wearer Feedback
          </h2>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs text-ink-muted hover:text-ink flex items-center gap-1 font-semibold"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        {session.proposals.length === 0 ? (
          <div className="parcel-card p-12 text-center bg-white space-y-3">
            <Sparkles className="w-8 h-8 text-ink-subtle mx-auto" />
            <h3 className="font-serif text-base font-bold text-ink">No Garments Proposed Yet</h3>
            <p className="text-xs text-ink-muted max-w-md mx-auto leading-relaxed">
              Use the form above to propose candidate garments. The wearer will receive your proposals
              and try them on in their private fitting mirror.
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

                {/* Garment Image Preview */}
                <div className="aspect-[4/3] bg-stone-light/40 rounded border border-stone overflow-hidden flex items-center justify-center relative">
                  {proposal.garment_preview_url ? (
                    <img
                      src={proposal.garment_preview_url}
                      alt={proposal.label}
                      className="w-full h-full object-contain p-4"
                    />
                  ) : (
                    <span className="text-xs text-ink-subtle">No garment preview</span>
                  )}
                  {/* Privacy Badge overlay */}
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-ink/75 text-white text-[10px] font-mono flex items-center gap-1">
                    <EyeOff className="w-3 h-3 text-white" />
                    <span>Wearer Photo Shielded</span>
                  </div>
                </div>

                {/* Try-On Execution Button if Ready */}
                {proposal.status === 'READY' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => generateTryOnMutation.mutate(proposal.id)}
                      disabled={generateTryOnMutation.isPending || isRevoked}
                      className="w-full py-2 bg-helper hover:bg-helper-dark text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Request Virtual Try-On</span>
                    </button>
                  </div>
                )}

                {/* Wearer Decision Slip Feedback */}
                <div className="p-3 rounded border border-stone bg-stone-light/20 space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle block">
                    Wearer Verdict
                  </span>
                  {proposal.decision ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        {proposal.decision === 'APPROVE' && (
                          <CheckCircle2 className="w-4 h-4 text-wearer" />
                        )}
                        {proposal.decision === 'MAYBE' && (
                          <HelpCircle className="w-4 h-4 text-ink-muted" />
                        )}
                        {proposal.decision === 'PASS' && (
                          <XCircle className="w-4 h-4 text-rust" />
                        )}
                        <span className="text-xs font-bold text-ink">
                          {proposal.decision === 'APPROVE' && 'Approved by Wearer'}
                          {proposal.decision === 'MAYBE' && 'Marked as Maybe'}
                          {proposal.decision === 'PASS' && 'Passed'}
                        </span>
                      </div>
                      {proposal.wearer_note && (
                        <p className="text-xs text-ink-muted italic pl-5">
                          "{proposal.wearer_note}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted italic">
                      Awaiting wearer private review...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
