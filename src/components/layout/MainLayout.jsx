import React from 'react';
import Header from './Header';
import Footer from './Footer';
import ChatWidget from '../common/ChatWidget';

const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-dark-950 relative overflow-hidden bg-grid-pattern">
      {/* Background Soft Glow Spots */}
      <div className="absolute top-[10%] left-[20%] w-[350px] h-[350px] bg-brand-500/10 rounded-full blur-spot animate-pulse-ring" />
      <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-brand-600/5 rounded-full blur-spot" />

      {/* Main Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col max-w-7xl w-full mx-auto px-4 md:px-8 py-8 relative z-10">
        {children}
      </main>

      {/* Main Footer */}
      <Footer />

      {/* SkillForge Floating Chat Widget */}
      <ChatWidget />
    </div>
  );
};

export default MainLayout;
