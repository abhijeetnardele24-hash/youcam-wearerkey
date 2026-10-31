import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { GarmentCategory } from '@wearerkey/contracts';
import { ShieldCheck, Upload, Sparkles, Check, ArrowRight, Clock, Layers } from 'lucide-react';

const ALL_CATEGORIES: { id: GarmentCategory; label: string; desc: string }[] = [
  { id: 'upper_body', label: 'Tops & Shirts', desc: 'Shirts, blouses, t-shirts, knitwear' },
  { id: 'lower_body', label: 'Bottoms & Pants', desc: 'Trousers, jeans, skirts, shorts' },
  { id: 'full_body', label: 'Full Outfits & Dresses', desc: 'Dresses, suits, jumpsuits' },
  { id: 'outer', label: 'Outerwear', desc: 'Coats, jackets, blazers, trench coats' },
  { id: 'shoes', label: 'Footwear & Shoes', desc: 'Sneakers, boots, formal shoes' },
  { id: 'auto', label: 'Auto Detect', desc: 'Allow YouCam engine to auto-detect category' },
];

export const CreatePassPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCategories, setSelectedCategories] = useState<GarmentCategory[]>([
    'upper_body',
    'outer',
  ]);
  const [maxProposals, setMaxProposals] = useState<number>(5);
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (cat: GarmentCategory) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length === 1) return; // Keep at least one
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleUseSamplePhoto = async () => {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 600;
    sampleCanvas.height = 800;
    const ctx = sampleCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#EBE3D3';
      ctx.fillRect(0, 0, 600, 800);

      ctx.fillStyle = '#1F624F';
      // Head
      ctx.beginPath();
      ctx.arc(300, 180, 70, 0, Math.PI * 2);
      ctx.fill();
      // Torso
      ctx.beginPath();
      ctx.moveTo(220, 260);
      ctx.lineTo(380, 260);
      ctx.lineTo(410, 520);
      ctx.lineTo(190, 520);
      ctx.closePath();
      ctx.fill();
      // Legs
      ctx.fillRect(230, 520, 60, 240);
      ctx.fillRect(310, 520, 60, 240);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sample Reference Silhouette', 300, 400);

      sampleCanvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'sample-wearer-reference.png', { type: 'image/png' });
          setSelectedFile(file);
          setFilePreview(URL.createObjectURL(file));
          setError(null);
        }
      }, 'image/png');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please provide a reference photo (or load the sample silhouette) before proceeding.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Create session & mint wearer capability
      const sessionResult = await api.createSession({
        allowed_categories: selectedCategories,
        max_proposals: maxProposals,
        expires_in_hours: expiryHours,
        gift_mode: false,
        consent_version: '2026-10-30-v1',
      });

      // Step 1.5: Bootstrap the session to get the wearer session cookie
      await api.bootstrap(sessionResult.wearer_bootstrap_code, 'wearer');

      // Step 2: Upload source image with authenticated wearer session cookie
      const formData = new FormData();
      formData.append('sourceImage', selectedFile);

      await api.updateWearerSession(formData);

      // Step 3: Navigate directly to wearer room
      navigate('/wearer');
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize Try-On Pass. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="parcel-card p-6 sm:p-8 bg-white border-2 border-stone">
        <div className="flex items-center gap-2 mb-2 text-wearer font-semibold text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Wearer Consent Protocol</span>
        </div>

        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink mb-2">
          Create Your Try-On Pass
        </h1>
        <p className="text-xs text-ink-muted leading-relaxed mb-6">
          Set the rules before sharing shopping access. YouCam Clothes V4 will only generate outfits in your approved categories, and your helper will never see your reference photo.
        </p>

        {error && (
          <div className="mb-6 p-3 rounded bg-rust-light border border-rust text-rust text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Permitted Categories */}
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-wearer" />
              1. Permitted Garment Categories
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_CATEGORIES.map((cat) => {
                const isChecked = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`p-3 rounded border text-left transition-colors flex items-start justify-between ${
                      isChecked
                        ? 'bg-wearer-light border-wearer text-wearer'
                        : 'bg-white border-stone text-ink-muted hover:bg-stone-light/30'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-ink">{cat.label}</div>
                      <div className="text-[11px] text-ink-subtle mt-0.5">{cat.desc}</div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center mt-0.5 ${
                        isChecked ? 'bg-wearer text-white border-wearer' : 'border-stone'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Budget & Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="budget" className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                2. Proposal Cap
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="budget"
                  type="range"
                  min="1"
                  max="10"
                  value={maxProposals}
                  onChange={(e) => setMaxProposals(parseInt(e.target.value, 10))}
                  className="flex-1 accent-wearer"
                />
                <span className="w-12 text-center font-mono font-bold text-xs px-2 py-1 bg-parchment rounded border border-stone">
                  {maxProposals} max
                </span>
              </div>
              <p className="text-[11px] text-ink-subtle mt-1">
                Maximum try-ons helper can propose.
              </p>
            </div>

            <div>
              <label
                htmlFor="expiry"
                className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5 flex items-center gap-1"
              >
                <Clock className="w-3.5 h-3.5 text-stone-dark" />
                3. Pass Expiration
              </label>
              <select
                id="expiry"
                value={expiryHours}
                onChange={(e) => setExpiryHours(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs rounded border border-stone bg-white text-ink font-medium"
              >
                <option value={1}>1 Hour (Quick session)</option>
                <option value={2}>2 Hours (Standard)</option>
                <option value={6}>6 Hours (Shopping trip)</option>
                <option value={24}>24 Hours (Full day)</option>
              </select>
            </div>
          </div>

          {/* Step 3: Reference Photo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-wearer" />
                4. Private Reference Photo
              </label>
              <button
                type="button"
                onClick={handleUseSamplePhoto}
                className="text-[11px] text-wearer hover:underline flex items-center gap-1 font-medium"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Use Sample Silhouette</span>
              </button>
            </div>

            <div className="parcel-border rounded-lg p-4 bg-parchment-100 text-center relative border-dashed">
              {filePreview ? (
                <div className="space-y-3">
                  <img
                    src={filePreview}
                    alt="Uploaded reference preview"
                    className="h-44 mx-auto rounded shadow-sm object-contain"
                  />
                  <div className="text-xs text-ink-muted">
                    Photo ready.{' '}
                    <span className="text-wearer font-medium">
                      Stays strictly in your private mirror.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreview(null);
                    }}
                    className="text-[11px] text-rust hover:underline"
                  >
                    Change photo
                  </button>
                </div>
              ) : (
                <div className="py-6">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-stone-dark" />
                  <p className="text-xs font-semibold text-ink mb-1">
                    Upload your full-body or torso photo
                  </p>
                  <p className="text-[11px] text-ink-subtle mb-3">
                    JPEG, PNG, or WebP up to 10MB. Stripped of EXIF metadata in memory.
                  </p>
                  <label className="inline-flex items-center px-4 py-2 bg-white text-ink border border-stone rounded text-xs font-semibold cursor-pointer hover:bg-stone-light/40 transition-colors shadow-sm">
                    <span>Select Photo</span>
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

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="w-full py-3.5 bg-wearer hover:bg-wearer-dark text-white rounded font-semibold text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <span>Generating Encrypted Try-On Pass...</span>
              ) : (
                <>
                  <span>Create Pass & Open Wearer Control Room</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-ink-subtle mt-2">
              🔒 Helper link is generated on the next screen. You can revoke it anytime.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
