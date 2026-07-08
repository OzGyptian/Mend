export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export interface AuthRepository {
  getCurrentUser(): AuthUser | null;
  signInWithOAuth(): Promise<AuthUser>;
  signInWithCredentials(email: string, password: string): Promise<AuthUser>;
  registerWithCredentials(email: string, password: string): Promise<AuthUser>;
  sendVerificationEmail(): Promise<void>;
  signOut(): Promise<void>;
  subscribeToAuth(callback: (user: AuthUser | null) => void): () => void;
  updateDisplayName(name: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(currentPassword: string, newPassword: string): Promise<void>;
  getLinkedProviders(): string[];
  linkEmailPassword(newPassword: string): Promise<void>;
}
