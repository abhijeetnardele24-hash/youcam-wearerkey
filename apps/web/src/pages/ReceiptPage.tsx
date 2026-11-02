import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { FileText, ShieldCheck, Check, Copy, ArrowLeft, Download } from 'lucide-react';

export const ReceiptPage: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const { data: receipt, isLoading, error } = useQuery({
    queryKey: ['audit-receipt'],
    queryFn: () => api.getReceipt(),
  });

  const handleCopy = () => {
    if (receipt) {
      navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (receipt) {
      const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wearerkey-deletion-receipt-${receipt.session_id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 rounded-full border-4 border-wearer border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-xs font-serif font-bold text-ink">Retrieving Cryptographic Audit Trail...</p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <FileText className="w-12 h-12 text-rust mx-auto mb-3" />
        <h2 className="font-serif text-xl font-bold text-ink mb-2">Audit Receipt Not Found</h2>
        <p className="text-xs text-ink-muted mb-6">
          Could not locate a valid session receipt. The session must be revoked or purged first to generate an immutable deletion assertion.
        </p>
        <Link to="/" className="text-xs text-wearer font-semibold hover:underline">
          Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="text-xs font-semibold text-ink-muted hover:text-ink flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return Home</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded border border-stone bg-white text-xs font-semibold text-ink hover:bg-stone-light/40 flex items-center gap-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-3 py-1.5 rounded border border-stone bg-white text-xs font-semibold text-ink hover:bg-stone-light/40 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      <div className="parcel-card p-6 bg-white space-y-6 border-2 border-stone">
        <div className="flex items-start justify-between border-b border-stone pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-wearer" />
              <h1 className="font-serif text-xl font-bold text-ink">
                Application-Signed Deletion Status Assertion
              </h1>
            </div>
            <p className="text-xs text-ink-muted">
              Evidence Schema {receipt.schema_version} • Version {receipt.receipt_version} • SHA-256 HMAC
            </p>
          </div>
          <span
            data-testid="receipt-status-badge"
            className={`text-xs font-mono font-semibold px-2.5 py-1 rounded ${
              receipt.deletion_verification_mode === 'SIMULATED'
                ? 'bg-stone-100 text-stone-700 border border-stone-300'
                : receipt.overall_deletion_status === 'CONFIRMED'
                  ? 'bg-wearer-light text-wearer border border-wearer/30'
                  : 'bg-rust-light text-rust'
            }`}
          >
            {receipt.deletion_verification_mode === 'SIMULATED'
              ? 'SIMULATED'
              : receipt.overall_deletion_status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-stone-light/30 rounded">
            <span className="text-ink-subtle text-[11px] block">Tasks Deleted</span>
            <span className="font-mono font-bold text-ink">
              {receipt.provider_tasks_deleted} / {receipt.provider_tasks_total}
            </span>
          </div>
          <div className="p-3 bg-stone-light/30 rounded">
            <span className="text-ink-subtle text-[11px] block">Remote Files</span>
            <span className="font-mono font-bold text-ink">
              {receipt.remote_files_deleted} / {receipt.remote_files_total}
            </span>
          </div>
          <div className="p-3 bg-stone-light/30 rounded">
            <span className="text-ink-subtle text-[11px] block">In-Memory Purge</span>
            <span className="font-mono font-bold text-wearer">
              {receipt.in_memory_buffers_purged ? 'CONFIRMED' : 'PENDING'}
            </span>
          </div>
          <div className="p-3 bg-stone-light/30 rounded">
            <span className="text-ink-subtle text-[11px] block">Local Access</span>
            <span className="font-mono font-bold text-rust">
              {receipt.local_access_revoked ? 'REVOKED' : 'ACTIVE'}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-serif text-sm font-bold text-ink">Raw Canonical Evidence (JSON)</h3>
          <pre
            tabIndex={0}
            role="region"
            aria-label="Raw Canonical Evidence JSON"
            className="p-4 bg-stone-light/40 rounded border border-stone font-mono text-[11px] text-ink overflow-x-auto max-h-96"
          >
            {JSON.stringify(receipt, null, 2)}
          </pre>
        </div>

        <div className="p-3 rounded bg-stone-light/20 border border-stone text-[11px] text-ink-muted leading-relaxed">
          <p className="font-semibold text-ink mb-0.5">Cryptographic Authenticity Note</p>
          {receipt.deletion_verification_mode === 'SIMULATED' ? (
            <p data-testid="simulated-receipt-note">
              Application-signed simulation ledger. Local buffers and access were cleared in the fixture workflow; no live YouCam deletion confirmation is claimed.
            </p>
          ) : receipt.deletion_verification_mode === 'GENUINE_PROVIDER_CONFIRMED' ? (
            <p data-testid="genuine-receipt-note">
              This deletion assertion is signed by WearerKey using HMAC-SHA256 with key ID{' '}
              <code className="text-ink font-mono">{receipt.receipt_hmac?.key_id || 'wearerkey-audit-key-v1'}</code>.
              It asserts local data zeroization and confirmation responses received from YouCam S2S deletion endpoints.
            </p>
          ) : (
            <p data-testid="unconfirmed-receipt-note">
              Application-signed audit receipt recording local zeroization. Upstream provider confirmation was not verified.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
