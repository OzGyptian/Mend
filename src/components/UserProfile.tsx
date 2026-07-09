import React, { useState, useEffect, useRef } from 'react';
import { useEnterpriseRepo, useAuthRepo } from '../platform/firestore/hooks';
import { Enterprise } from '../types';
import { 
  User, 
  Mail, 
  Shield, 
  Camera, 
  CheckCircle2, 
  Clock, 
  Settings, 
  Bell, 
  Lock,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  Save,
  RefreshCw
} from 'lucide-react';

interface UserProfileProps {
  userId: string;
  enterprise: Enterprise;
}

export default function UserProfile({ userId, enterprise }: UserProfileProps) {
  const enterpriseRepo = useEnterpriseRepo();
  const authRepo = useAuthRepo();
  const [userData, setUserData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGoogleOnly = linkedProviders.includes('google.com') && !linkedProviders.includes('password');

  useEffect(() => {
    setLinkedProviders(authRepo.getLinkedProviders());
  }, []);

  useEffect(() => {
    if (!enterprise || !userId) return;
    const user = enterprise.users?.[userId] as any;
    const currentUser = authRepo.getCurrentUser();
    if (user) {
      setUserData({
        ...user,
        displayName: user.displayName || currentUser?.displayName || '',
        email: user.email || currentUser?.email || '',
        preferences: user.preferences || {
          notifications: true,
          darkMode: true,
          language: 'en'
        }
      });
    }
  }, [enterprise, userId]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file.');
      return;
    }

    if (file.size > 800 * 1024) {
      alert('File is too large. Please upload an image smaller than 800KB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setUserData((prev: any) => ({ ...prev, photoURL: base64String }));
      
      // Auto-save photo
      try {
        await enterpriseRepo.update(enterprise.id, {
          [`users.${userId}.photoURL`]: base64String
        } as any);
      } catch (error) {
        console.error('Failed to save photo', error);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        enterpriseRepo.update(enterprise.id, {
          [`users.${userId}.displayName`]: userData.displayName,
          [`users.${userId}.preferences`]: userData.preferences
        } as any),
        authRepo.updateDisplayName(userData.displayName),
      ]);
    } catch (error) {
      console.error('Failed to save preferences', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    const email = authRepo.getCurrentUser()?.email;
    if (!email) return;
    setIsPasswordLoading(true);
    setPasswordFeedback(null);
    try {
      await authRepo.sendPasswordReset(email);
      setPasswordFeedback({ type: 'success', message: `Password reset email sent to ${email}. Click the link in the email to set your password.` });
    } catch (err: any) {
      setPasswordFeedback({ type: 'error', message: err.message ?? 'Failed to send reset email.' });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) return;
    if (!isGoogleOnly && !currentPassword) return;
    setIsPasswordLoading(true);
    setPasswordFeedback(null);
    try {
      if (isGoogleOnly) {
        await authRepo.linkEmailPassword(newPassword);
        setLinkedProviders(authRepo.getLinkedProviders());
        setPasswordFeedback({ type: 'success', message: 'Password set. You can now sign in with email and password.' });
      } else {
        await authRepo.updatePassword(currentPassword, newPassword);
        setPasswordFeedback({ type: 'success', message: 'Password updated successfully.' });
      }
      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordForm(false);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPasswordFeedback({ type: 'error', message: 'Current password is incorrect.' });
      } else if (err.code === 'auth/provider-already-linked') {
        setPasswordFeedback({ type: 'error', message: 'A password is already set. Sign out and sign in with email/password to change it.' });
      } else if (err.code === 'auth/requires-recent-login') {
        setPasswordFeedback({ type: 'error', message: 'Session expired. Please sign out and sign back in, then try again.' });
      } else {
        setPasswordFeedback({ type: 'error', message: err.message ?? 'Failed to update password.' });
      }
    } finally {
      setIsPasswordLoading(false);
    }
  };

  if (!userData) return null;

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold dark:text-white">User Profile</h1>
          <p className="text-sm text-gray-500">Manage your personal information and preferences.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Photo & Basic Info */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#141414] p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm text-center">
              <div className="relative inline-block group">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 dark:bg-white/5 border-4 border-white dark:border-[#141414] shadow-lg mx-auto">
                  {userData.photoURL ? (
                    <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50 dark:bg-blue-500/10 text-blue-600">
                      <User className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              
              <div className="mt-4">
                <h2 className="text-lg font-bold dark:text-white">{userData.displayName}</h2>
                <p className="text-xs text-gray-500 font-mono">{userData.role}</p>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-white/5 space-y-3 text-left">
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{userData.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Shield className="w-4 h-4" />
                  <span>{userData.role}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>Joined {new Date(userData.joinedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Quick Tasks Placeholder */}
            <div className="bg-white dark:bg-[#141414] p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
              <h3 className="text-sm font-bold mb-4 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                My Tasks
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 opacity-50">
                  <p className="text-xs font-medium dark:text-white">Review Q1 Forecast</p>
                  <p className="text-[10px] text-gray-400 mt-1">Due in 2 days</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 opacity-50">
                  <p className="text-xs font-medium dark:text-white">Approve Subcontractor Invoice</p>
                  <p className="text-[10px] text-gray-400 mt-1">Due today</p>
                </div>
                <p className="text-[10px] text-center text-gray-400 italic">More task features coming soon...</p>
              </div>
            </div>
          </div>

          {/* Right Column: Settings & Preferences */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white dark:bg-[#141414] p-8 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
              <h3 className="text-lg font-bold mb-6 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                Account Settings
              </h3>

              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Display Name</label>
                    <input 
                      type="text"
                      value={userData.displayName}
                      onChange={e => setUserData((prev: any) => ({ ...prev, displayName: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Email Address</label>
                    <input 
                      type="email"
                      value={userData.email}
                      disabled
                      className="w-full px-4 py-2.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-500 cursor-not-allowed outline-none"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-white/5">
                  <h4 className="text-sm font-bold mb-4 dark:text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-orange-500" />
                    Preferences
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                      <div>
                        <p className="text-sm font-medium dark:text-white">Email Notifications</p>
                        <p className="text-xs text-gray-500">Receive updates about project changes.</p>
                      </div>
                      <button 
                        onClick={() => setUserData((prev: any) => ({ 
                          ...prev, 
                          preferences: { ...prev.preferences, notifications: !prev.preferences.notifications } 
                        }))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${userData.preferences.notifications ? 'bg-blue-600' : 'bg-gray-300 dark:bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${userData.preferences.notifications ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                      <div>
                        <p className="text-sm font-medium dark:text-white">Dark Mode</p>
                        <p className="text-xs text-gray-500">Toggle between light and dark themes.</p>
                      </div>
                      <button 
                        onClick={() => setUserData((prev: any) => ({ 
                          ...prev, 
                          preferences: { ...prev.preferences, darkMode: !prev.preferences.darkMode } 
                        }))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${userData.preferences.darkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${userData.preferences.darkMode ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-white/5">
                  <h4 className="text-sm font-bold mb-4 dark:text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-red-500" />
                    Security
                  </h4>

                  {passwordFeedback && (
                    <div className={`mb-4 p-3 rounded-xl text-sm ${passwordFeedback.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                      {passwordFeedback.message}
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {/* Works for all users — Google OAuth users receive a "set password" link */}
                    <button
                      onClick={handleSendPasswordReset}
                      disabled={isPasswordLoading}
                      className="self-start px-4 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      {isPasswordLoading && !showPasswordForm ? 'Sending…' : 'Send Password Reset Email'}
                    </button>

                    {/* Direct change / set password */}
                    <button
                      onClick={() => { setShowPasswordForm(f => !f); setPasswordFeedback(null); }}
                      className="self-start px-4 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                      {showPasswordForm ? 'Cancel' : isGoogleOnly ? 'Set a Password' : 'Change Password Directly'}
                    </button>

                    {showPasswordForm && (
                      <div className="flex flex-col gap-2 mt-1">
                        {isGoogleOnly ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            You signed in with Google. Setting a password will also let you sign in with email and password. You'll be asked to confirm via a Google sign-in popup.
                          </p>
                        ) : (
                          <div className="relative">
                            <input
                              type={showCurrentPassword ? 'text' : 'password'}
                              placeholder="Current password"
                              value={currentPassword}
                              onChange={e => setCurrentPassword(e.target.value)}
                              className="w-full px-3 py-2 pr-9 text-sm border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                            />
                            <button type="button" onClick={() => setShowCurrentPassword(v => !v)} tabIndex={-1} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                              {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            placeholder={isGoogleOnly ? 'New password' : 'New password'}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 pr-9 text-sm border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                          />
                          <button type="button" onClick={() => setShowNewPassword(v => !v)} tabIndex={-1} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          onClick={handleChangePassword}
                          disabled={isPasswordLoading || (!isGoogleOnly && !currentPassword) || !newPassword}
                          className="self-start px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 transition-transform disabled:opacity-50"
                        >
                          {isPasswordLoading ? (isGoogleOnly ? 'Setting…' : 'Updating…') : isGoogleOnly ? 'Set Password' : 'Update Password'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8 flex justify-end">
                  <button 
                    onClick={handleSavePreferences}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold uppercase tracking-widest hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
