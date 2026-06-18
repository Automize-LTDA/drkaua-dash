import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword as fbSignIn, 
  signOut as fbSignOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, isFirebaseAvailable } from '../firebase/firebase-config';

interface User {
  uid: string;
  email: string | null;
  isMock?: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFirebaseAvailable && auth) {
      // Connect to Firebase Authentication
      const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
        if (user) {
          setCurrentUser({
            uid: user.uid,
            email: user.email
          });
        } else {
          setCurrentUser(null);
        }
        setLoading(false);
      });
      return unsubscribe;
    } else {
      // Check local session storage for mock login
      const mockSession = sessionStorage.getItem('kf_mock_user');
      if (mockSession) {
        setCurrentUser(JSON.parse(mockSession));
      }
      setLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string): Promise<void> => {
    if (isFirebaseAvailable && auth) {
      // Firebase login
      // Trick: if user writes admin, autocomplete email
      let emailAddress = email;
      if (!email.includes('@')) {
        emailAddress = `${email}@drkauafelipe.com`;
      }
      await fbSignIn(auth, emailAddress, pass);
    } else {
      // Mock login validation
      const cleanEmail = email.toLowerCase().trim();
      const isUsernameAdmin = cleanEmail === 'admin' || cleanEmail === 'admin@drkauafelipe.com';
      const isPasswordAdmin = pass === 'admin';

      if (isUsernameAdmin && isPasswordAdmin) {
        const mockUser: User = {
          uid: 'mock-admin-id',
          email: 'admin@drkauafelipe.com',
          isMock: true
        };
        sessionStorage.setItem('kf_mock_user', JSON.stringify(mockUser));
        setCurrentUser(mockUser);
      } else {
        throw new Error('Usuário ou senha incorretos! (Modo Mock: use admin/admin)');
      }
    }
  };

  const logout = async (): Promise<void> => {
    if (isFirebaseAvailable && auth) {
      await fbSignOut(auth);
    } else {
      sessionStorage.removeItem('kf_mock_user');
      setCurrentUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
