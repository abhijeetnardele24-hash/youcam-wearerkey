import React from 'react';
import { Lock, Cpu, EyeOff, KeyRound } from 'lucide-react';
import { BoundaryDiagram } from '../components/BoundaryDiagram';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-wearer-light text-wearer border border-wearer-border/30 text-xs font-semibold mb-3">
          <KeyRound className="w-3.5 h-3.5" />
          <span>Technical Whitepaper & Data Model</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-ink mb-3">
          About WearerKey & the Privacy Protocol
        </h1>
        <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
          WearerKey is built for the YouCam Skin AI & eCommerce VTO Hackathon 2026. It solves the core privacy dilemma of collaborative shopping: getting advice from friends or stylists without surrendering private body photos.
        </p>
      </div>

      <BoundaryDiagram />

      {/* Deep Dive Sections */}
      <div className="space-y-6 text-sm text-ink leading-relaxed">
        <div className="parcel-card p-6 bg-white border border-stone">
          <div className="flex items-center gap-2 mb-3 text-wearer">
            <Lock className="w-5 h-5" />
            <h2 className="font-serif text-xl font-bold text-ink">
              1. Capability-Based Role Authorization
            </h2>
          </div>
          <p className="text-xs text-ink-muted mb-3">
            Traditional web apps rely on shared session IDs or user accounts. WearerKey uses cryptographically isolated capability tokens:
          </p>
          <ul className="text-xs text-ink-muted list-disc list-inside space-y-1.5">
            <li>
              <strong>Wearer Capability:</strong> Holds complete control over consent policy, reference photo upload, private mirror streaming, and pass revocation. Stored solely as a SHA-256 hash in the database.
            </li>
            <li>
              <strong>Helper Capability:</strong> Scoped exclusively to proposing garments and viewing wearer decisions. Helper queries are executed via distinct route handlers where wearer photos and try-on URLs are completely omitted from the data transfer objects (DTOs).
            </li>
            <li>
              <strong>Timing-Safe Verification:</strong> Capability verification utilizes <code className="bg-stone-light/50 px-1 py-0.5 rounded text-ink">crypto.timingSafeEqual</code> to prevent timing-attack vector vulnerabilities.
            </li>
          </ul>
        </div>

        <div className="parcel-card p-6 bg-white border border-stone">
          <div className="flex items-center gap-2 mb-3 text-rust">
            <Cpu className="w-5 h-5" />
            <h2 className="font-serif text-xl font-bold text-ink">
              2. YouCam AI Clothes V4 Orchestration
            </h2>
          </div>
          <p className="text-xs text-ink-muted mb-3">
            WearerKey implements Perfect Corp's official YouCam Clothes V4 Server-to-Server API (<code className="text-ink font-mono text-[11px]">/s2s/v2.0/task/cloth-v4</code>):
          </p>
          <ul className="text-xs text-ink-muted list-disc list-inside space-y-1.5">
            <li>
              <strong>Asynchronous Task Lifecycle:</strong> Files are securely uploaded to YouCam's File API, returning an ephemeral file ID. The async task is polled with exponential backoff until completion.
            </li>
            <li>
              <strong>In-Memory Sharp Sanitization:</strong> Before transmission, raw images are stripped of GPS and camera EXIF metadata in memory, resized to compliant bounds (under 10MB), and re-encoded.
            </li>
            <li>
              <strong>Automatic Provider Purge:</strong> Once the try-on result is securely proxied to the wearer's private mirror, WearerKey initiates an immediate deletion request for the remote file ID, producing a signed audit receipt.
            </li>
          </ul>
        </div>

        <div className="parcel-card p-6 bg-white border border-stone">
          <div className="flex items-center gap-2 mb-3 text-helper">
            <EyeOff className="w-5 h-5" />
            <h2 className="font-serif text-xl font-bold text-ink">
              3. Responsible AI & Explicit Product Boundaries
            </h2>
          </div>
          <p className="text-xs text-ink-muted mb-3">
            In accordance with the hackathon rules and honest engineering principles, WearerKey explicitly states its boundaries:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded bg-parchment-100 border border-stone">
              <strong className="text-ink block mb-1">What WearerKey IS:</strong>
              <p className="text-ink-muted">
                An aesthetic drape and outfit simulation aid that protects wearer privacy while enabling joint fashion curation.
              </p>
            </div>
            <div className="p-3 rounded bg-rust-light/50 border border-rust/40">
              <strong className="text-rust block mb-1">What WearerKey IS NOT:</strong>
              <p className="text-ink-muted">
                Not a certified medical body scanner, tailor sizing guarantee, automated checkout bot, or arbitrary web scraper.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
