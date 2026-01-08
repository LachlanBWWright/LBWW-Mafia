import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  setGuestMode: () => void;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // Load stored auth on mount
    void loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await SecureStore.getItemAsync('authToken');
      const storedUser = await SecureStore.getItemAsync('user');
      const guestMode = await SecureStore.getItemAsync('guestMode');

      if (guestMode === 'true') {
        setIsGuest(true);
      } else if (storedToken && storedUser) {
        setToken(storedToken);
        const parsedUser = JSON.parse(storedUser) as User;
        setUser(parsedUser);
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(_idToken: string) {
    try {
      setIsLoading(true);
      // TODO: Call tRPC googleMobileAuth endpoint
      // For now, we'll throw an error to direct users to demo mode
      throw new Error('Google authentication not yet implemented');
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    try {
      setUser(null);
      setToken(null);
      setIsGuest(false);
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('user');
      await SecureStore.deleteItemAsync('guestMode');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }

  function setGuestMode() {
    setIsGuest(true);
    void SecureStore.setItemAsync('guestMode', 'true');
    setIsLoading(false);
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: !!user || isGuest,
      signIn,
      signOut,
      setGuestMode,
      isGuest,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
