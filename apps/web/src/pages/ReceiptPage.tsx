import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { FileText, ShieldCheck, Check, Copy, ArrowLeft, Download } from 'lucide-react';

export const ReceiptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [copied, setCopied] = useState(false);

  const { data: receipt, isLoading, error } = useQuery({
    queryKey: ['audit-receipt', token || 'current'],
    queryFn: async () => {
      if (token) {
        try {
          return await api.getWearerReceipt(token);
        } catch (e: any) {
          if (e.statusCode === 403 || e.statusCode === 401) {
            return await api.getHelperReceipt(token);
          }
          throw e;
        }
      }
      // Without token in URL: authenticate via cookie or session header
      return await api.getReceipt();
    },
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
      a.download = `wearerkey-receipt-${token?.slice(0, 8)}.json`;
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
          Could not locate a valid session receipt for this capability token.
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

      <div className="parcel-card p-6 bg-white border-2 border-stone space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-light">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-wearer-light text-wearer flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold text-ink">
                Session Deletion & Privacy Receipt
              </h1>
              <span className="text-[11px] text-ink-subtle">
                Commit SHA: {receipt.evaluated_commit_sha || 'Local Dev'}
              </span>
            </div>
          </div>
          <span className="seal-badge seal-neutral font-mono text-[10px]">
            Status: {receipt.status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded bg-parchment-100 border border-stone/50 space-y-1">
            <span className="text-ink-subtle text-[11px] font-medium block">Session ID</span>
            <span className="font-mono font-semibold text-ink">{receipt.session_id}</span>
          </div>

          <div className="p-3 rounded bg-parchment-100 border border-stone/50 space-y-1">
            <span className="text-ink-subtle text-[11px] font-medium block">Provider Task Count</span>
            <span className="font-mono font-semibold text-ink">
              {receipt.provider_task_count ?? 0} tasks executed
            </span>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
            Verifiable Machine Receipt (JSON)
          </h3>
          <pre className="p-4 rounded bg-ink text-parchment font-mono text-[11px] overflow-x-auto leading-relaxed max-h-96">
            {JSON.stringify(receipt, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
