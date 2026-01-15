"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

type AuthContextType = AuthState & {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: AUTH_MODE === "firebase",
    error: null,
  });

  useEffect(() => {
    if (AUTH_MODE !== "firebase") {
      return;
    }

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setState({ user, loading: false, error: null });
      },
      (error) => {
        setState({ user: null, loading: false, error: error.message });
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (AUTH_MODE !== "firebase") {
      return;
    }

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ログインに失敗しました";
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  };

  const signOut = async () => {
    if (AUTH_MODE !== "firebase") {
      return;
    }

    try {
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ログアウトに失敗しました";
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (AUTH_MODE !== "firebase" || !state.user) {
      return null;
    }

    try {
      return await state.user.getIdToken();
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signInWithGoogle,
        signOut,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
