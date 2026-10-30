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
      <Header />
      <main className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreatePassPage />} />
          <Route path="/wearer/:token" element={<WearerRoomPage />} />
          <Route path="/helper/:token" element={<HelperRoomPage />} />
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
