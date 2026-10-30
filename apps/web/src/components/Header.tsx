import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { Sparkles, KeyRound, HelpCircle } from 'lucide-react';

export const Header: React.FC = () => {
  const location = useLocation();
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.getHealth(),
    staleTime: 30000,
  });

  const providerMode = health?.provider_mode || 'DEMO_FIXTURE';

  return (
    <header className="border-b border-stone bg-parchment-100/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded bg-wearer text-white flex items-center justify-center font-bold tracking-tight shadow-sm group-hover:bg-wearer-dark transition-colors">
              <KeyRound className="w-5 h-5 text-parchment" />
            </div>
            <div>
              <span className="font-serif text-xl font-bold tracking-tight text-ink block leading-none">
                WearerKey
              </span>
              <span className="text-[10px] uppercase tracking-wider text-ink-subtle font-medium block mt-0.5">
                Private Try-On Protocol
              </span>
            </div>
          </Link>

          {/* Provider status pill */}
          <div className="hidden md:flex items-center ml-4">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                providerMode === 'LIVE_YOUCAM'
                  ? 'bg-wearer-light text-wearer border border-wearer-border'
                  : providerMode === 'RECORDED_LIVE_RESULT'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-stone-light text-ink-muted border border-stone'
              }`}
              title={`Provider: ${providerMode} | YouCam Clothes V4`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  providerMode === 'LIVE_YOUCAM'
                    ? 'bg-wearer'
                    : providerMode === 'RECORDED_LIVE_RESULT'
                    ? 'bg-amber-600'
                    : 'bg-stone-dark'
                }`}
              />
              {providerMode === 'LIVE_YOUCAM'
                ? 'YouCam Live'
                : providerMode === 'RECORDED_LIVE_RESULT'
                ? 'Recorded Live'
                : 'Demo Fixture'}
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
          <Link
            to="/create"
            className={`px-3 py-1.5 rounded transition-colors ${
              location.pathname === '/create'
                ? 'bg-wearer text-white'
                : 'text-ink hover:bg-stone-light/50'
            }`}
          >
            Create Pass
          </Link>
          <Link
            to="/judge"
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              location.pathname === '/judge'
                ? 'bg-helper text-white'
                : 'text-helper bg-helper-light hover:bg-helper-light/80 border border-helper-border/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Judge Tour</span>
          </Link>
          <Link
            to="/about"
            aria-label="About & Model"
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${
              location.pathname === '/about'
                ? 'bg-ink text-white'
                : 'text-ink hover:bg-stone-light/50'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">About & Model</span>
          </Link>
        </nav>
      </div>
    </header>
  );
};
