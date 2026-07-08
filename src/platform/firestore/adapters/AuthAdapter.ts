import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import type { AuthUser, AuthRepository } from '../../ports/auth.port';

function toAuthUser(user: User): AuthUser {
  return {
    id: user.uid,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.photoURL,
    emailVerified: user.emailVerified,
  };
}

export class AuthAdapter implements AuthRepository {
  private auth = getAuth();

  getCurrentUser(): AuthUser | null {
    return this.auth.currentUser ? toAuthUser(this.auth.currentUser) : null;
  }

  async signInWithOAuth(): Promise<AuthUser> {
    const result = await signInWithPopup(this.auth, new GoogleAuthProvider());
    return toAuthUser(result.user);
  }

  async signInWithCredentials(email: string, password: string): Promise<AuthUser> {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    return toAuthUser(result.user);
  }

  async registerWithCredentials(email: string, password: string): Promise<AuthUser> {
    const result = await createUserWithEmailAndPassword(this.auth, email, password);
    return toAuthUser(result.user);
  }

  async sendVerificationEmail(): Promise<void> {
    if (!this.auth.currentUser) throw new Error('No authenticated user');
    await sendEmailVerification(this.auth.currentUser);
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  subscribeToAuth(callback: (user: AuthUser | null) => void): () => void {
    return onAuthStateChanged(this.auth, (user) => {
      callback(user ? toAuthUser(user) : null);
    });
  }

  async updateDisplayName(name: string): Promise<void> {
    if (!this.auth.currentUser) throw new Error('No authenticated user');
    await updateProfile(this.auth.currentUser, { displayName: name });
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) throw new Error('No authenticated user');
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await fbUpdatePassword(user, newPassword);
  }
}
