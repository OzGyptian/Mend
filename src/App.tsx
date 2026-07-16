import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthRepo, useEnterpriseRepo, useProjectRepo, useAuth } from './platform/firestore/hooks';
import type { AuthUser } from './platform/ports/auth.port';
import { Enterprise, Project, Sheet } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import EnterpriseDashboard from './components/EnterpriseDashboard';
import ProjectDashboard from './components/ProjectDashboard';
import ForecastGrid from './components/ForecastGrid';
import SystemAdmin from './components/SystemAdmin';
import EnterpriseAdmin from './components/EnterpriseAdmin';
import ProjectAdmin from './components/ProjectAdmin';
import UserProfile from './components/UserProfile';
import LandingPage from './components/LandingPage';
import { ExternalLink, ShieldAlert, Building2, Plus, ArrowRight, LogOut, CalendarCheck2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';
import { ConfirmDialogProvider } from './components/ConfirmDialogProvider';

export default function App() {
  const authRepo = useAuthRepo();
  const enterpriseRepo = useEnterpriseRepo();
  const projectRepo = useProjectRepo();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  // enterprises starts as [] before the first async fetch resolves, so
  // `enterprises.length === 0` can't tell "still loading" apart from
  // "genuinely has none" -- routes that require an enterprise need the
  // former to show a loading state, not redirect away.
  const [enterprisesLoaded, setEnterprisesLoaded] = useState(false);
  const [currentEnterprise, setCurrentEnterprise] = useState<Enterprise | null>(null);
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState<string | null>(
    () => localStorage.getItem('selectedEnterpriseId')
  );
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentSheet, setCurrentSheet] = useState<Sheet | null>(null);
  const [currentModule, setCurrentModule] = useState<string>('dashboard');
  const [view, setView] = useState<'enterprise' | 'project' | 'sheet' | 'system-admin' | 'enterprise-admin' | 'project-admin' | 'profile'>('enterprise');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [isInIframe, setIsInIframe] = useState(false);
  const { isPlatformAdmin: isSystemOwner, loading: authLoading } = useAuth();
  // Scoped per user id -- a global key meant a platform admin's last-viewed
  // enterprise leaked into the *next* account signed into the same browser
  // (e.g. testing with one account, then a real user signs in on the same
  // machine), silently pointing them at an enterprise id their session
  // can't actually resolve, with no error and no way out except knowing to
  // go to System Admin and click "Switch To" themselves.
  const systemOwnerStorageKey = user ? `systemOwnerEnterpriseId:${user.id}` : null;
  const [systemOwnerEnterpriseId, setSystemOwnerEnterpriseId] = useState<string | null>(() => {
    try { return user ? localStorage.getItem(`systemOwnerEnterpriseId:${user.id}`) : null; } catch (e) { return null; }
  });

  // The lazy useState initializer above only ever runs once, on the very
  // first render -- and user is always null at that exact point (it's a
  // separate piece of state that only resolves once subscribeToAuth's
  // callback fires, asynchronously, below). So that initializer always
  // read `user ? ... : null` as null, never actually reading the real
  // localStorage value at all -- meaning a switched-to enterprise was
  // *never* restored on reload, regardless of any other fix to how the
  // fallback-to-ents[0] logic behaves once systemOwnerEnterpriseId is
  // null. Read it again here, once user.id is actually known.
  useEffect(() => {
    if (!systemOwnerStorageKey) return;
    try {
      const stored = localStorage.getItem(systemOwnerStorageKey);
      if (stored) setSystemOwnerEnterpriseId((prev) => prev ?? stored);
    } catch (e) { console.warn('LocalStorage access failed', e); }
  }, [systemOwnerStorageKey]);

  useEffect(() => {
    if (!systemOwnerStorageKey) return;
    try {
      if (systemOwnerEnterpriseId) { localStorage.setItem(systemOwnerStorageKey, systemOwnerEnterpriseId); }
      else { localStorage.removeItem(systemOwnerStorageKey); }
    } catch (e) { console.warn('LocalStorage access failed', e); }
    setCurrentProject(null);
    setCurrentSheet(null);
    setView('enterprise');
  }, [systemOwnerEnterpriseId]);

  const handleEnterpriseSwitch = (enterprise: Enterprise) => {
    setCurrentProject(null);
    setCurrentSheet(null);
    setView('enterprise');
    if (isSystemOwner) {
      setSystemOwnerEnterpriseId(enterprise.id);
      if (systemOwnerStorageKey) localStorage.setItem(systemOwnerStorageKey, enterprise.id);
    } else {
      setSelectedEnterpriseId(enterprise.id);
      localStorage.setItem('selectedEnterpriseId', enterprise.id);
    }
  };

  useEffect(() => {
    try { setIsInIframe(window.self !== window.top); } catch (e) { setIsInIframe(true); }
  }, []);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    return authRepo.subscribeToAuth((u) => {
      setUser(u);
      setLoading(false);
      if (u) handlePendingInvitation();
    });
  }, []);

  const handlePendingInvitation = async () => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) return;
    try {
      const result = await enterpriseRepo.acceptInvitation(token);
      if (result) toast.success(`Welcome! You've been added to ${result.enterpriseName}.`);
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : 'Failed to process invitation.');
      console.error('Failed to process invitation:', error);
    }
  };

  useEffect(() => {
    // authLoading is true until useAuth()'s roles fetch resolves, during
    // which isSystemOwner holds its default (false) value -- not yet known,
    // not confirmed false. Without this gate, this effect fired on that
    // default, subscribed a platform admin to the member-only path (correctly
    // empty, since a platform admin usually isn't a real enterprise_members
    // row), and set enterprisesLoaded=true from that wrong, empty result --
    // which downstream code had no way to distinguish from a genuinely empty
    // list, since both look identical: enterprisesLoaded=true, length 0.
    if (!user || authLoading || isSystemOwner) return;
    return enterpriseRepo.subscribeByUserId(user.id, (ents) => {
      setEnterprises(ents);
      setEnterprisesLoaded(true);
      setSelectedEnterpriseId(prev => prev ?? ents[0]?.id ?? null);
    });
  }, [user?.id, authLoading, isSystemOwner]);

  useEffect(() => {
    if (!user || authLoading || !isSystemOwner) return;
    return enterpriseRepo.subscribeAll(async (ents) => {
      setEnterprises(ents);
      setEnterprisesLoaded(true);
      setSystemOwnerEnterpriseId(prev => {
        // A cached id from a previous session that no longer resolves --
        // the enterprise was deleted, or (before the per-user storage key
        // fix above) leaked in from a different account on the same
        // browser -- used to get trusted forever with no fallback, leaving
        // the whole app stuck on an empty dashboard with every "requires
        // an enterprise" route silently bouncing back to it. Validate
        // against what this session can actually see before trusting it.
        if (prev && ents.some((e) => e.id === prev)) return prev;
        // A genuinely empty response can't confirm prev is invalid -- it's
        // far more likely a transient/incomplete fetch than proof the
        // selected enterprise disappeared. Switching to an enterprise via
        // System Admin, then refreshing, hit exactly this: the correct id
        // (read from localStorage on mount) got silently cleared to null by
        // this callback's *first*, empty invocation, and a later, correct
        // invocation then had no way to know null used to mean something --
        // it just fell back to ents[0], reverting the switch on every
        // reload. Only actually reset to ents[0] once we have real data to
        // check prev against.
        if (ents.length === 0) return prev;
        const first = ents[0]?.id ?? null;
        if (first && systemOwnerStorageKey) localStorage.setItem(systemOwnerStorageKey, first);
        return first;
      });
      if (ents.length === 0) {
        try { await enterpriseRepo.bootstrapIfEmpty(user.id, 'Global Construction Corp', 'Enterprise System Admin'); }
        catch (error) {
          console.error('Bootstrap failed', error);
          toast.error('Failed to set up your workspace. Please refresh the page or contact support.');
        }
      }
    });
  }, [user?.id, authLoading, isSystemOwner]);

  // Subscribe to the currently-selected enterprise and load its projects
  const activeEnterpriseId = isSystemOwner ? systemOwnerEnterpriseId : selectedEnterpriseId;
  useEffect(() => {
    if (!user || !activeEnterpriseId) return;
    return enterpriseRepo.subscribeById(activeEnterpriseId, (ent) => {
      setCurrentEnterprise(ent);
      if (ent) projectRepo.listByEnterprise(ent.id).then(setProjects);
    });
  }, [user?.id, activeEnterpriseId]);
  // True while an enterprise selection is genuinely still in flight.
  // enterprisesLoaded and the setSystemOwnerEnterpriseId/setSelectedEnterpriseId
  // call that picks activeEnterpriseId come from the *same* subscribeAll/
  // subscribeByUserId callback, but React doesn't guarantee both state
  // updates are visible in the same render -- there's a real render where
  // enterprisesLoaded is already true but activeEnterpriseId hasn't caught
  // up yet, even though enterprises.length > 0 proves one is coming. Without
  // accounting for that, this looked "resolved" (enterprisesLoaded=true,
  // activeEnterpriseId=null treated as "confirmed none") for exactly one
  // render, which was enough to redirect away before the real value landed.
  const enterpriseSelectionPending =
    !enterprisesLoaded ||
    (enterprises.length > 0 && !activeEnterpriseId) ||
    (!!activeEnterpriseId && !currentEnterprise);

  useEffect(() => {
    if (!user || !currentProject?.id) return;
    return projectRepo.subscribe(currentProject.id, (p) => { if (p) setCurrentProject(p); });
  }, [user?.id, currentProject?.id]);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await authRepo.signInWithOAuth();
    } catch (error: any) {
      console.error('Login failed', error);
      if (error.code === 'auth/popup-blocked') {
        setAuthError('The login popup was blocked. Please click "Open in New Tab" below to sign in.');
      } else if (error.message?.includes('cookie')) {
        setAuthError('Your browser is blocking security cookies. Please click "Open in New Tab" below.');
      } else {
        setAuthError('Authentication failed. Please try opening the app in a new tab.');
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (isRegistering) {
        await authRepo.registerWithCredentials(email, password);
        await authRepo.sendVerificationEmail();
        toast.success('A verification email has been sent. Please check your inbox to complete registration.');
      } else {
        await authRepo.signInWithCredentials(email, password);
      }
    } catch (error: any) {
      console.error('Email auth failed', error);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('This email is already registered. Try signing in instead.');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('Password should be at least 6 characters.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setAuthError('Invalid email or password.');
      } else if (error.code === 'auth/too-many-requests') {
        setAuthError('Too many failed attempts. Please try again later.');
      } else {
        setAuthError('Authentication failed. Please try again.');
      }
    }
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <ConfirmDialogProvider>
      <BrowserRouter>
      <AuthenticatedApp
        user={user}
        loading={loading} 
        currentEnterprise={currentEnterprise}
        setCurrentEnterprise={setCurrentEnterprise}
        enterpriseSelectionPending={enterpriseSelectionPending}
        isSystemOwner={isSystemOwner}
        systemOwnerEnterpriseId={systemOwnerEnterpriseId}
        setSystemOwnerEnterpriseId={setSystemOwnerEnterpriseId}
        theme={theme}
        setTheme={setTheme}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        authError={authError}
        setAuthError={setAuthError}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        isRegistering={isRegistering}
        setIsRegistering={setIsRegistering}
        showLanding={showLanding}
        setShowLanding={setShowLanding}
        isInIframe={isInIframe}
        handleLogin={handleLogin}
        handleEmailAuth={handleEmailAuth}
        openInNewTab={openInNewTab}
        projects={projects}
        enterprises={enterprises}
        onEnterpriseChange={handleEnterpriseSwitch}
      />
      </BrowserRouter>
      </ConfirmDialogProvider>
    </>
  );
}

interface AuthenticatedAppProps {
  user: AuthUser | null;
  loading: boolean;
  currentEnterprise: Enterprise | null;
  setCurrentEnterprise: (e: Enterprise | null) => void;
  enterpriseSelectionPending: boolean;
  isSystemOwner: boolean;
  systemOwnerEnterpriseId: string | null;
  setSystemOwnerEnterpriseId: (id: string | null) => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (c: boolean) => void;
  authError: string | null;
  setAuthError: (e: string | null) => void;
  email: string;
  setEmail: (e: string) => void;
  password: string;
  setPassword: (p: string) => void;
  isRegistering: boolean;
  setIsRegistering: (r: boolean) => void;
  showLanding: boolean;
  setShowLanding: (s: boolean) => void;
  isInIframe: boolean;
  handleLogin: () => Promise<void>;
  handleEmailAuth: (e: React.FormEvent) => Promise<void>;
  openInNewTab: () => void;
  projects: Project[];
  enterprises: Enterprise[];
  onEnterpriseChange: (enterprise: Enterprise) => void;
}

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );
}

function AuthenticatedApp({
  user, loading, currentEnterprise, setCurrentEnterprise, enterpriseSelectionPending, isSystemOwner,
  systemOwnerEnterpriseId, setSystemOwnerEnterpriseId, theme, setTheme,
  isSidebarCollapsed, setIsSidebarCollapsed, authError, setAuthError,
  email, setEmail, password, setPassword, isRegistering, setIsRegistering,
  showLanding, setShowLanding,
  isInIframe, handleLogin, handleEmailAuth, openInNewTab,
  projects, enterprises, onEnterpriseChange
}: AuthenticatedAppProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const authRepo = useAuthRepo();
  const enterpriseRepo = useEnterpriseRepo();
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingEnterprise, setIsCreatingEnterprise] = useState(false);
  const [newEnterpriseName, setNewEnterpriseName] = useState('');
  const [isSubmittingEnterprise, setIsSubmittingEnterprise] = useState(false);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F5F5F4]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-black rounded-full mb-4"></div>
          <p className="text-xs font-mono uppercase tracking-widest opacity-50">Initializing System...</p>
        </div>
      </div>
    );
  }

  if (user && !user.emailVerified && !isSystemOwner) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F5F5F4] p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-3xl shadow-sm text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Verify your email</h2>
          <p className="text-sm text-gray-900 mb-8 leading-relaxed">
            We've sent a verification email to <span className="font-bold text-black">{user.email}</span>. 
            Please verify your email address to access your enterprise workspace.
          </p>
          <div className="space-y-4">
            <button 
              onClick={() => authRepo.sendVerificationEmail().then(() => toast.success('Verification email resent!'))}
              className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-black/90 transition-colors"
            >
              Resend Verification Email
            </button>
            <button 
              onClick={() => authRepo.signOut()}
              className="w-full py-3 border border-gray-200 hover:bg-gray-50 text-black rounded-lg font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
          <p className="mt-8 text-[10px] text-gray-600 uppercase tracking-widest">
            Refresh this page after verifying your email.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showLanding && !isInIframe) {
      return (
        <LandingPage 
          onGetStarted={() => {
            setIsRegistering(true);
            setShowLanding(false);
          }}
          onLogin={() => {
            setIsRegistering(false);
            setShowLanding(false);
          }}
        />
      );
    }

    return (
      <div className="h-screen w-screen flex flex-col lg:flex-row">
        <div className="flex-1 bg-[#141414] text-white p-12 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-12">
              <div className="w-8 h-8 bg-[#FF6321] rounded flex items-center justify-center font-bold text-black">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="font-bold tracking-tight text-xl text-white">Mend</span>
            </div>
            <h1 className="text-6xl font-light tracking-tight leading-none mb-6">
              Precision <br />
              <span className="italic font-serif text-[#FF6321]">project controls.</span>
            </h1>
            <p className="text-white/60 max-w-md leading-relaxed">
              Mend is the integrated platform for enterprise construction performance. Track cost, schedule, risk, and procurement in one unified reporting environment.
            </p>
          </div>
          <div className="flex gap-8 text-[10px] font-mono uppercase tracking-widest opacity-40">
            <span>SOC2 Type II Compliant</span>
            <span>256-bit Encryption</span>
          </div>
        </div>
        <div className="flex-1 bg-white flex items-center justify-center p-12">
          <div className="w-full max-w-sm">
            {isInIframe ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ExternalLink className="w-8 h-8 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Launch App</h2>
                <p className="text-sm text-gray-900 mb-8 leading-relaxed">
                  To ensure a secure connection and fix login issues on iPhone/Safari, please launch the application in a new window.
                </p>
                  <button 
                    onClick={openInNewTab}
                    className="w-full py-4 bg-[#FF6321] text-black rounded-xl font-bold hover:bg-[#FF6321]/90 transition-all shadow-lg shadow-[#FF6321]/20 flex items-center justify-center gap-3"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Launch Mend
                  </button>
                <p className="mt-6 text-[10px] text-gray-600 uppercase tracking-widest font-bold">
                  Secure Enterprise Access
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-2">{isRegistering ? 'Create Account' : 'Sign In'}</h2>
                <p className="text-sm text-gray-900 mb-8">
                  {isRegistering ? 'Join your enterprise workspace.' : 'Enter your credentials to access your workspace.'}
                </p>
                
                {authError && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">{authError}</p>
                  </div>
                )}

                <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">Email Address</label>
                    <input 
                      required
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">Password</label>
                    <div className="relative">
                      <input
                        required
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-black/90 transition-colors"
                  >
                    {isRegistering ? 'Register' : 'Sign In'}
                  </button>
                </form>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-100"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-gray-600">
                    <span className="bg-white px-4">Or continue with</span>
                  </div>
                </div>

                <button 
                  onClick={handleLogin}
                  className="w-full py-3 px-4 border border-gray-200 hover:bg-gray-50 text-black rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mb-8"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
                  Sign in with Google
                </button>
                
                <div className="pt-8 border-t border-gray-100 flex flex-col gap-4">
                  <button 
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="text-sm text-black hover:text-gray-700 transition-colors"
                  >
                    {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register"}
                  </button>
                </div>
              </>
            )}
            
            <div className="mt-12 flex justify-between text-[10px] text-gray-600 uppercase tracking-widest font-medium">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                System Status: Operational
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F5F5F4] p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-3xl shadow-sm text-center">
          <h2 className="text-2xl font-bold mb-4">Session Expired</h2>
          <p className="text-sm text-gray-900 mb-8">Please refresh or navigate to the home page to sign in.</p>
          <button onClick={() => setShowLanding(true)} className="w-full py-3 bg-black text-white rounded-lg">Return to Home</button>
        </div>
      </div>
    );
  }

  if (!currentEnterprise && !loading && !isSystemOwner && !enterpriseSelectionPending) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F5F5F4] p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-3xl shadow-sm text-center">
          <div className="w-16 h-16 bg-[#FF6321]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8 text-[#FF6321]" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Welcome to Mend</h2>
          <p className="text-sm text-gray-900 mb-8 leading-relaxed">
            You are not currently associated with an enterprise. Please contact your administrator or create a new enterprise workspace.
          </p>
          <div className="space-y-4">
            {isCreatingEnterprise ? (
              <form
                className="space-y-3 text-left"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = newEnterpriseName.trim();
                  if (!name) return;
                  setIsSubmittingEnterprise(true);
                  try {
                    await enterpriseRepo.create({ name, adminUsers: [user.id], users: { [user.id]: { name: user.displayName || user.email?.split('@')[0] || 'Admin', email: user.email, role: 'Enterprise System Admin', joinedAt: new Date().toISOString() } } } as any);
                  } catch (e) {
                    toast.error('Failed to create enterprise. Please try again.');
                    setIsSubmittingEnterprise(false);
                  }
                }}
              >
                <label htmlFor="new-enterprise-name" className="block text-sm font-medium text-gray-900">
                  Enterprise Name
                </label>
                <input
                  id="new-enterprise-name"
                  autoFocus
                  type="text"
                  value={newEnterpriseName}
                  onChange={(e) => setNewEnterpriseName(e.target.value)}
                  placeholder="e.g. Acme Construction"
                  disabled={isSubmittingEnterprise}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6321]/40 disabled:opacity-50"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isSubmittingEnterprise}
                    onClick={() => { setIsCreatingEnterprise(false); setNewEnterpriseName(''); }}
                    className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-black rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEnterprise || !newEnterpriseName.trim()}
                    className="flex-1 py-3 bg-black text-white rounded-lg font-medium hover:bg-black/90 transition-colors disabled:opacity-50"
                  >
                    {isSubmittingEnterprise ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setIsCreatingEnterprise(true)}
                className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-black/90 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create New Enterprise
              </button>
            )}
            <button
              onClick={() => authRepo.signOut()}
              className="w-full py-3 border border-gray-200 hover:bg-gray-50 text-black rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <Sidebar 
        enterprise={currentEnterprise}
        userEmail={user.email}
        userId={user.id}
        theme={theme}
        setTheme={setTheme}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0A0A0A] transition-colors duration-300">
        <Header
          user={user}
          enterprise={currentEnterprise}
          enterprises={enterprises}
          onEnterpriseChange={onEnterpriseChange}
        />
        <main className="flex-1 flex flex-col overflow-hidden bg-[#F5F5F4] dark:bg-[#0A0A0A] transition-colors duration-300">
          <Routes>
            <Route path="/" element={
              <EnterpriseDashboard 
                enterprise={currentEnterprise} 
                userId={user.id}
                isSystemOwner={isSystemOwner}
              />
            } />
            <Route path="/project/:projectId" element={<ProjectView enterprise={currentEnterprise} user={user} setIsSidebarCollapsed={setIsSidebarCollapsed} />} />
            <Route path="/project/:projectId/:moduleId" element={<ProjectView enterprise={currentEnterprise} user={user} setIsSidebarCollapsed={setIsSidebarCollapsed} />} />
            <Route path="/project/:projectId/:moduleId/:subModuleId" element={<ProjectView enterprise={currentEnterprise} user={user} setIsSidebarCollapsed={setIsSidebarCollapsed} />} />
            <Route path="/project/:projectId/sheet/:sheetId" element={<ProjectView enterprise={currentEnterprise} user={user} theme={theme} setIsSidebarCollapsed={setIsSidebarCollapsed} />} />
            
            <Route path="/system-admin" element={
              <SystemAdmin 
                currentEnterpriseId={currentEnterprise?.id}
                onSwitchEnterprise={(id) => {
                  setSystemOwnerEnterpriseId(id);
                  navigate('/');
                }}
              />
            } />
            <Route path="/enterprise-admin" element={
              enterpriseSelectionPending ? <RouteLoadingFallback /> :
              currentEnterprise ? <EnterpriseAdmin enterprise={currentEnterprise} setIsSidebarCollapsed={setIsSidebarCollapsed} /> : <Navigate to="/" />
            } />
            <Route path="/profile" element={
              enterpriseSelectionPending ? <RouteLoadingFallback /> :
              currentEnterprise ? <UserProfile userId={user.id} enterprise={currentEnterprise} /> : <Navigate to="/" />
            } />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function ProjectView({ enterprise, user, theme, setIsSidebarCollapsed }: { enterprise: Enterprise | null, user: AuthUser, theme?: 'light' | 'dark', setIsSidebarCollapsed?: (c: boolean) => void }) {
  const { projectId, moduleId, subModuleId, sheetId } = useParams();
  const navigate = useNavigate();
  const projectRepo = useProjectRepo();
  const [project, setProject] = useState<Project | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  useEffect(() => {
    if (!projectId) return;
    return projectRepo.subscribe(projectId, (p) => { if (p) setProject(p); });
  }, [projectId]);

  useEffect(() => {
    if (!sheetId) { setSheet(null); return; }
    return projectRepo.subscribeSheet(sheetId, setSheet);
  }, [sheetId]);

  if (!project || !enterprise) return null;

  if (sheetId && sheet) {
    return <ForecastGrid sheet={sheet} project={project} enterprise={enterprise} theme={theme || 'light'} />;
  }

  if (moduleId === 'project-admin') {
    return <ProjectAdmin project={project} enterprise={enterprise} />;
  }

  return (
    <ProjectDashboard 
      project={project} 
      enterprise={enterprise}
      currentModule={moduleId || 'dashboard'}
      subModuleId={subModuleId}
      onSelectSheet={(sheet) => window.location.href = `/project/${project.id}/sheet/${sheet.id}`}
      setIsSidebarCollapsed={setIsSidebarCollapsed}
      user={user}
      theme={theme}
    />
  );
}
