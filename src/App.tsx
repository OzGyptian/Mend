import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, getDoc, getDocs, limit } from 'firebase/firestore';
import { Enterprise, Project, Sheet } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import EnterpriseDashboard from './components/EnterpriseDashboard';
import ProjectDashboard from './components/ProjectDashboard';
import ForecastGrid from './components/ForecastGrid';
import SystemAdmin from './components/SystemAdmin';
import EnterpriseAdmin from './components/EnterpriseAdmin';
import ProjectAdmin from './components/ProjectAdmin';
import LandingPage from './components/LandingPage';
import { ExternalLink, ShieldAlert, Building2, Plus, ArrowRight, LogOut, CalendarCheck2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentEnterprise, setCurrentEnterprise] = useState<Enterprise | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentSheet, setCurrentSheet] = useState<Sheet | null>(null);
  const [view, setView] = useState<'enterprise' | 'project' | 'sheet' | 'system-admin' | 'enterprise-admin' | 'project-admin'>('enterprise');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [isInIframe, setIsInIframe] = useState(false);
  const [systemOwnerEnterpriseId, setSystemOwnerEnterpriseId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('systemOwnerEnterpriseId');
    } catch (e) {
      return null;
    }
  });

  const isSystemOwner = user?.email === 'tarek.guindy@gmail.com';

  useEffect(() => {
    try {
      if (systemOwnerEnterpriseId) {
        localStorage.setItem('systemOwnerEnterpriseId', systemOwnerEnterpriseId);
      } else {
        localStorage.removeItem('systemOwnerEnterpriseId');
      }
    } catch (e) {
      console.warn('LocalStorage access failed', e);
    }
    // Reset current project and sheet when switching enterprises
    setCurrentProject(null);
    setCurrentSheet(null);
    setView('enterprise');
  }, [systemOwnerEnterpriseId]);
  useEffect(() => {
    // Check if the app is running in an iframe
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      
      // Handle invitation if present in URL
      if (u) {
        handlePendingInvitation(u);
      }
    });
    return () => unsubscribe();
  }, []);

  const handlePendingInvitation = async (u: User) => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      try {
        // 1. Find the invitation by token
        const q = query(collection(db, 'invitations'), where('token', '==', token), where('status', '==', 'pending'), limit(1));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const inviteDoc = snapshot.docs[0];
          const inviteData = inviteDoc.data();
          
          // 2. Security Check: Email must match (if provided in invite)
          if (inviteData.email && u.email?.toLowerCase() !== inviteData.email.toLowerCase()) {
            setAuthError(`This invitation was sent to ${inviteData.email}. Please sign in with that account.`);
            return;
          }

          // 3. Security Check: Token expiration
          if (new Date(inviteData.expiresAt) < new Date()) {
            setAuthError('This invitation has expired. Please ask for a new one.');
            return;
          }

          // 4. Add user to Enterprise
          const enterpriseRef = doc(db, 'enterprises', inviteData.enterpriseId);
          const enterpriseSnap = await getDoc(enterpriseRef);
          
          if (enterpriseSnap.exists()) {
            const data = enterpriseSnap.data();
            const users = data.users || {};
            
            if (!users[u.uid]) {
              await updateDoc(enterpriseRef, {
                [`users.${u.uid}`]: {
                  name: u.displayName || u.email?.split('@')[0] || 'New User',
                  email: u.email,
                  role: 'Enterprise User',
                  joinedAt: new Date().toISOString()
                },
                adminUsers: [...(data.adminUsers || []), u.uid]
              });
            }

            // 5. Mark invitation as accepted
            await updateDoc(inviteDoc.ref, {
              status: 'accepted',
              acceptedAt: new Date().toISOString(),
              acceptedBy: u.uid
            });

            // 6. Clear URL params
            window.history.replaceState({}, document.title, window.location.pathname);
            alert(`Welcome! You've been added to ${data.name}.`);
          }
        }
      } catch (error) {
        console.error('Failed to process invitation:', error);
      }
    }
  };

  useEffect(() => {
    if (!user) return;

    // Fetch Enterprise
    const enterpriseQuery = isSystemOwner && systemOwnerEnterpriseId
      ? query(collection(db, 'enterprises'), where('__name__', '==', systemOwnerEnterpriseId))
      : query(collection(db, 'enterprises'), where('adminUsers', 'array-contains', user.uid));

    const unsubscribe = onSnapshot(enterpriseQuery, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = { ...doc.data() as Enterprise, id: doc.id };
        setCurrentEnterprise(data);
      } else {
        setCurrentEnterprise(null);
      }
    }, (error) => {
      console.error("Enterprise fetch error:", error);
    });
    return () => unsubscribe();
  }, [user, systemOwnerEnterpriseId]);

  useEffect(() => {
    if (!user || user.email !== 'tarek.guindy@gmail.com') return;

    // Check if any enterprise exists
    const q = query(collection(db, 'enterprises'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        try {
          await addDoc(collection(db, 'enterprises'), {
            name: 'Global Construction Corp',
            adminUsers: [user.uid],
            settings: { theme: 'dark' },
            users: {
              [user.uid]: {
                name: 'Tarek Guindy',
                role: 'Enterprise System Admin'
              }
            }
          });
        } catch (error) {
          console.error('Bootstrap failed', error);
        }
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !currentProject?.id) return;

    const unsubscribe = onSnapshot(doc(db, 'projects', currentProject.id), (snapshot) => {
      if (snapshot.exists()) {
        setCurrentProject({ ...snapshot.data() as Project, id: snapshot.id });
      }
    }, (error) => {
      console.error("Current project fetch error:", error);
    });
    return () => unsubscribe();
  }, [user, currentProject?.id]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
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
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        alert('A verification email has been sent. Please check your inbox to complete registration.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
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

  if (user && !user.emailVerified) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F5F5F4] p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-3xl shadow-sm text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Verify your email</h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            We've sent a verification email to <span className="font-bold text-black">{user.email}</span>. 
            Please verify your email address to access your enterprise workspace.
          </p>
          <div className="space-y-4">
            <button 
              onClick={() => sendEmailVerification(user).then(() => alert('Verification email resent!'))}
              className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-black/90 transition-colors"
            >
              Resend Verification Email
            </button>
            <button 
              onClick={() => auth.signOut()}
              className="w-full py-3 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
          <p className="mt-8 text-[10px] text-gray-400 uppercase tracking-widest">
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
                <CalendarCheck2 className="w-5 h-5" />
              </div>
              <span className="font-bold tracking-tight text-xl text-white">Mend</span>
            </div>
            <h1 className="text-6xl font-light tracking-tight leading-none mb-6">
              Master your <br />
              <span className="italic font-serif">month-end cycle.</span>
            </h1>
            <p className="text-white/60 max-w-md">
              Mend (Month End) is the integrated platform for construction project performance. Track cost, schedule, risk, and procurement in one unified reporting cycle.
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
                <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                  To ensure a secure connection and fix login issues on iPhone/Safari, please launch the application in a new window.
                </p>
                  <button 
                    onClick={openInNewTab}
                    className="w-full py-4 bg-[#FF6321] text-black rounded-xl font-bold hover:bg-[#FF6321]/90 transition-all shadow-lg shadow-[#FF6321]/20 flex items-center justify-center gap-3"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Launch Mend
                  </button>
                <p className="mt-6 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                  Secure Enterprise Access
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-2">{isRegistering ? 'Create Account' : 'Sign In'}</h2>
                <p className="text-sm text-gray-500 mb-8">
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
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Email Address</label>
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
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Password</label>
                    <input 
                      required
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
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
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-gray-400">
                    <span className="bg-white px-4">Or continue with</span>
                  </div>
                </div>

                <button 
                  onClick={handleLogin}
                  className="w-full py-3 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mb-8"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
                  Sign in with Google
                </button>
                
                <div className="pt-8 border-t border-gray-100 flex flex-col gap-4">
                  <button 
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="text-sm text-gray-600 hover:text-black transition-colors"
                  >
                    {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register"}
                  </button>
                </div>
              </>
            )}
            
            <div className="mt-12 flex justify-between text-[10px] text-gray-400 uppercase tracking-widest font-medium">
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

  if (user && !currentEnterprise && !loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F5F5F4] p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-3xl shadow-sm text-center">
          <div className="w-16 h-16 bg-[#FF6321]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8 text-[#FF6321]" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Welcome to Mend</h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            You are not currently associated with an enterprise. Please contact your administrator or create a new enterprise workspace.
          </p>
          <div className="space-y-4">
            <button 
              onClick={async () => {
                const name = prompt('Enter your Enterprise Name:');
                if (name) {
                  try {
                    await addDoc(collection(db, 'enterprises'), {
                      name,
                      adminUsers: [user.uid],
                      users: {
                        [user.uid]: {
                          name: user.displayName || user.email?.split('@')[0] || 'Admin',
                          email: user.email,
                          role: 'Enterprise System Admin',
                          joinedAt: new Date().toISOString()
                        }
                      }
                    });
                  } catch (e) {
                    alert('Failed to create enterprise. Please try again.');
                  }
                }
              }}
              className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-black/90 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New Enterprise
            </button>
            <button 
              onClick={() => auth.signOut()}
              className="w-full py-3 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
        currentView={view} 
        setView={setView} 
        enterprise={currentEnterprise}
        project={currentProject}
        sheet={currentSheet}
        userEmail={user.email}
        userId={user.uid}
        theme={theme}
        setTheme={setTheme}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onClearEnterprise={() => setSystemOwnerEnterpriseId(null)}
      />
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0A0A0A] transition-colors duration-300">
        <Header 
          user={user} 
          enterprise={currentEnterprise} 
          project={currentProject} 
          sheet={currentSheet}
          view={view}
          setView={setView}
        />
        <main className="flex-1 flex flex-col overflow-hidden bg-[#F5F5F4] dark:bg-[#0A0A0A] transition-colors duration-300">
          {view === 'enterprise' && (
            <EnterpriseDashboard 
              enterprise={currentEnterprise} 
              userId={user.uid}
              isSystemOwner={isSystemOwner}
              onSelectProject={(p) => {
                setCurrentProject(p);
                setView('project');
              }}
            />
          )}
          {view === 'project' && currentProject && currentEnterprise && (
            <ProjectDashboard 
              project={currentProject} 
              enterprise={currentEnterprise}
              onSelectSheet={(s) => {
                setCurrentSheet(s);
                setView('sheet');
              }}
            />
          )}
          {view === 'sheet' && currentSheet && currentProject && currentEnterprise && (
            <ForecastGrid 
              sheet={currentSheet} 
              project={currentProject}
              enterprise={currentEnterprise}
              theme={theme}
            />
          )}
          {view === 'system-admin' && (
            <SystemAdmin 
              currentEnterpriseId={currentEnterprise?.id}
              onSwitchEnterprise={(id) => {
                setSystemOwnerEnterpriseId(id);
                setView('enterprise');
              }} 
            />
          )}
          {view === 'enterprise-admin' && currentEnterprise && (
            <EnterpriseAdmin enterprise={currentEnterprise} />
          )}
          {view === 'project-admin' && currentProject && currentEnterprise && (
            <ProjectAdmin project={currentProject} enterprise={currentEnterprise} />
          )}
        </main>
      </div>
    </div>
  );
}
