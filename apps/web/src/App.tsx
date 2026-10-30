import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { CreatePassPage } from './pages/CreatePassPage';
import { WearerRoomPage } from './pages/WearerRoomPage';
import { HelperRoomPage } from './pages/HelperRoomPage';
import { ReceiptPage } from './pages/ReceiptPage';
import { JudgeTourPage } from './pages/JudgeTourPage';
import { AboutPage } from './pages/AboutPage';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-parchment text-ink font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:p-2.5 focus:bg-white focus:text-ink focus:border focus:border-stone focus:shadow-md focus:rounded text-xs font-semibold"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 pb-16 focus:outline-none">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreatePassPage />} />
          <Route path="/wearer/:token" element={<WearerRoomPage />} />
          <Route path="/wearer" element={<WearerRoomPage />} />
          <Route path="/helper/:token" element={<HelperRoomPage />} />
          <Route path="/helper" element={<HelperRoomPage />} />
          <Route path="/receipt/:token" element={<ReceiptPage />} />
          <Route path="/judge" element={<JudgeTourPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-stone bg-parchment-100 py-6 text-center text-xs text-ink-muted">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>WearerKey — Private Collaborative Virtual Try-On Protocol</span>
          <span className="font-mono text-[11px] text-ink-subtle">
            YouCam AI Clothes V4 • Perfect Corp Hackathon 2026
          </span>
        </div>
      </footer>
    </div>
  );
};
