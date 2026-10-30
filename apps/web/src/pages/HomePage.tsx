import React from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Sparkles, ShieldCheck, ArrowRight, EyeOff, Lock } from 'lucide-react';
import { BoundaryDiagram } from '../components/BoundaryDiagram';
import { VisibilityRail } from '../components/VisibilityRail';

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-12 py-6 sm:py-10">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-wearer-light text-wearer border border-wearer-border/30 text-xs font-semibold mb-6">
          <KeyRound className="w-3.5 h-3.5" />
          <span>YouCam Skin AI & eCommerce VTO Hackathon 2026</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-5xl font-bold text-ink tracking-tight leading-[1.15] mb-5">
          Shop together without sharing the wearer's photo.
        </h1>

        <p className="text-base sm:text-lg text-ink-muted leading-relaxed mb-8 max-w-2xl mx-auto">
          WearerKey is a private collaborative virtual try-on protocol. A wearer privately generates a Try-On Pass; their helper proposes clothes without ever seeing or receiving the wearer's body photo or try-on render.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            to="/create"
            className="w-full sm:w-auto px-6 py-3.5 rounded bg-wearer hover:bg-wearer-dark text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 group"
          >
            <span>Create a Try-On Pass</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            to="/judge"
            className="w-full sm:w-auto px-6 py-3.5 rounded bg-helper-light hover:bg-helper-light/80 text-helper border border-helper-border/40 font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-helper" />
            <span>Launch 30-Second Judge Tour</span>
          </Link>
        </div>
      </section>

      {/* Visibility Rail Component */}
      <section className="max-w-4xl mx-auto px-4">
        <VisibilityRail />
      </section>

      {/* Boundary Architecture Diagram */}
      <section className="max-w-4xl mx-auto px-4">
        <BoundaryDiagram />
      </section>

      {/* 3 Core Value Pillars */}
      <section className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="parcel-card p-5 bg-white">
          <div className="w-9 h-9 rounded bg-wearer-light text-wearer flex items-center justify-center mb-4">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-lg font-bold text-ink mb-2">
            Wearer-Only Mirror
          </h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            The wearer's full reference photo and the YouCam Clothes V4 try-on result stream directly into the wearer's private mirror. The helper never gets raw URLs or preview access.
          </p>
        </div>

        <div className="parcel-card p-5 bg-white">
          <div className="w-9 h-9 rounded bg-helper-light text-helper flex items-center justify-center mb-4">
            <EyeOff className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-lg font-bold text-ink mb-2">
            Zero-Knowledge Curation
          </h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            Friends, stylists, or partners propose garments within permitted categories. They get feedback through a standardized Decision Slip (Approve, Maybe, Pass) and safe notes.
          </p>
        </div>

        <div className="parcel-card p-5 bg-white">
          <div className="w-9 h-9 rounded bg-stone-light text-rust flex items-center justify-center mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-lg font-bold text-ink mb-2">
            Server-Enforced Purge
          </h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            Images are processed in memory with Sharp EXIF stripping. Provider tasks are ephemeral and immediately requested for deletion upon delivery. Full cryptographic receipts provided.
          </p>
        </div>
      </section>

      {/* Truthfulness & Quality Disclaimer Footer Callout */}
      <section className="max-w-3xl mx-auto px-4">
        <div className="rounded border border-stone bg-parchment-200/60 p-4 text-center">
          <p className="text-xs text-ink-muted">
            <strong className="text-ink">Responsible AI & VTO Disclosure:</strong> WearerKey simulates clothing drape and visual appearance using YouCam AI Clothes V4. It is an aesthetic decision aid, not a certified sizing, tailoring, or stretch guarantee.
          </p>
        </div>
      </section>
    </div>
  );
};
