import React from 'react';
import { Shield, BarChart3, Users, Zap, ArrowRight, CheckCircle2, Building2 } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export default function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white text-black selection:bg-[#FF6321] selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FF6321] rounded flex items-center justify-center font-bold text-black">BU</div>
            <span className="font-bold tracking-tight text-xl">CostForecast Pro</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
            <a href="#features" className="hover:text-black transition-colors">Features</a>
            <a href="#solutions" className="hover:text-black transition-colors">Solutions</a>
            <a href="#security" className="hover:text-black transition-colors">Security</a>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onLogin}
              className="px-4 py-2 text-sm font-medium hover:text-[#FF6321] transition-colors"
            >
              Sign In
            </button>
            <button 
              onClick={onGetStarted}
              className="px-6 py-2.5 bg-black text-white rounded-full text-sm font-bold hover:bg-black/90 transition-all shadow-lg shadow-black/10"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-widest mb-8">
              <Zap className="w-3 h-3" />
              Next-Gen Project Controls
            </div>
            <h1 className="text-7xl md:text-8xl font-light tracking-tighter leading-[0.9] mb-8">
              Precision forecasting for <br />
              <span className="italic font-serif">complex projects.</span>
            </h1>
            <p className="text-xl text-gray-500 mb-12 leading-relaxed max-w-xl">
              The enterprise-grade commercial dashboard for modern construction. Track variations, manage project spend, and forecast with confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={onGetStarted}
                className="px-8 py-4 bg-[#FF6321] text-black rounded-full font-bold text-lg hover:scale-105 transition-all shadow-xl shadow-[#FF6321]/20 flex items-center justify-center gap-3 group"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="px-8 py-4 border border-gray-200 rounded-full font-bold text-lg hover:bg-gray-50 transition-all">
                Request Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats/Social Proof */}
      <section className="py-12 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12">
          {[
            { label: 'Project Value Managed', value: '$12.4B+' },
            { label: 'Active Enterprises', value: '450+' },
            { label: 'Forecast Accuracy', value: '99.2%' },
            { label: 'Time Saved', value: '40%' },
          ].map((stat, i) => (
            <div key={i}>
              <p className="text-3xl font-bold mb-1">{stat.value}</p>
              <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="space-y-6">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold">Real-time Dashboards</h3>
              <p className="text-gray-500 leading-relaxed">
                Live visibility into project performance. Track EAC, Cost-to-Go, and variations across your entire portfolio.
              </p>
            </div>
            <div className="space-y-6">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold">Enterprise Hierarchy</h3>
              <p className="text-gray-500 leading-relaxed">
                Structured access control from global enterprise level down to individual project sheets.
              </p>
            </div>
            <div className="space-y-6">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold">Smart Distribution</h3>
              <p className="text-gray-500 leading-relaxed">
                Automated time-phasing with bell curves, front-loading, and manual overrides for precise cash flow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-24 px-6 bg-black text-white rounded-[3rem] mx-6 mb-24 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#FF6321]/20 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-2xl">
            <h2 className="text-5xl font-bold mb-8">Enterprise-Grade <br /> Security by Default</h2>
            <div className="grid sm:grid-cols-2 gap-8">
              {[
                'SOC2 Type II Compliant',
                '256-bit AES Encryption',
                'Multi-Factor Authentication',
                'Role-Based Access Control',
                'Audit Logging',
                'Daily Backups'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#FF6321]" />
                  <span className="text-white/80 font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#FF6321] rounded flex items-center justify-center font-bold text-black text-xs">BU</div>
            <span className="font-bold tracking-tight text-sm">CostForecast Pro</span>
          </div>
          <div className="flex gap-8 text-xs text-gray-400 font-medium">
            <a href="#" className="hover:text-black transition-colors">Privacy</a>
            <a href="#" className="hover:text-black transition-colors">Terms</a>
            <a href="#" className="hover:text-black transition-colors">Contact</a>
          </div>
          <p className="text-xs text-gray-400">© 2026 CostForecast Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
