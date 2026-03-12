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
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, ensureFirestoreNetwork } from "@/lib/firebase";

export type AuthProviderType = "google" | "facebook" | "yahoo";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  coolId: string | null;
  createdAt: string;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  privacyAccepted?: boolean;
  privacyAcceptedAt?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isSigningIn: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signInWithYahoo: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrCreateProfile = async (firebaseUser: User): Promise<UserProfile | null> => {
    if (!db) {
      console.log("[Auth] fetchOrCreateProfile: db not configured, skipping");
      return null;
    }
    console.log("[Auth] fetchOrCreateProfile: fetching for", firebaseUser.uid, firebaseUser.email);
    const database = db;
    const userRef = doc(database, "users", firebaseUser.uid);

    const tryFetch = async (retries = 4): Promise<UserProfile | null> => {
      try {
        await ensureFirestoreNetwork();
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          console.log("[Auth] fetchOrCreateProfile: found existing profile", { coolId: data.coolId });

          if (!data.coolId) {
            try {
              const { collection, query, where, getDocs, limit } = await import("firebase/firestore");
              const q = query(collection(database, "usernames"), where("uid", "==", firebaseUser.uid), limit(1));
              const unameSnap = await getDocs(q);
              if (!unameSnap.empty) {
                const recoveredId = unameSnap.docs[0].id;
                await setDoc(userRef, { coolId: recoveredId }, { merge: true });
                data.coolId = recoveredId;
                console.log("[Auth] fetchOrCreateProfile: recovered missing coolId", recoveredId);
              }
            } catch (e) {
              console.warn("[Auth] fetchOrCreateProfile: could not recover coolId", e);
            }
          }

          return data;
        }
        console.log("[Auth] fetchOrCreateProfile: no existing profile, creating new");
        const newProfile: Partial<UserProfile> = {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? null,
          displayName: firebaseUser.displayName ?? null,
          photoURL: firebaseUser.photoURL ?? null,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, newProfile, { merge: true });
        console.log("[Auth] fetchOrCreateProfile: created new profile / merged defaults");
        // Re-fetch to get complete object
        const finalSnap = await getDoc(userRef);
        return (finalSnap.exists() ? finalSnap.data() : { ...newProfile, coolId: null }) as UserProfile;
      } catch (err) {
        console.warn("[Auth] fetchOrCreateProfile: error (retries left:", retries, ")", err);
        const isOffline =
          err instanceof Error &&
          (err.message.includes("offline") || err.message.includes("Failed to get document"));
        if (isOffline && retries > 0) {
          await new Promise((r) => setTimeout(r, 2000));
          return tryFetch(retries - 1);
        }
        throw err;
      }
    };

    return tryFetch();
  };

  const refreshProfile = async () => {
    if (!user || !db) return;
    const firestore = db;
    const userRef = doc(firestore, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      setProfile(snap.data() as UserProfile);
    }
  };

  useEffect(() => {
    ensureFirestoreNetwork();
  }, []);

  useEffect(() => {
    console.log("[Auth] AuthProvider mount: auth=", !!auth, "db=", !!db);
    if (!auth) {
      console.log("[Auth] No auth, setting loading=false");
      setLoading(false);
      return;
    }

    let mounted = true;
    console.log("[Auth] Checking getRedirectResult (returning from OAuth?)...");
    getRedirectResult(auth)
      .then(async (result) => {
        if (!mounted) return;
        if (result?.user) {
          console.log("[Auth] Redirect result: signed in as", result.user.email);
          setUser(result.user);
          try {
            const p = await fetchOrCreateProfile(result.user);
            if (mounted) setProfile(p);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[Auth] Redirect profile fetch failed:", err);
            if (msg.includes("permission-denied") || msg.includes("FirebaseError")) {
              console.error("[Auth] Firestore permission denied — check firestore.rules allow read/write for users/{userId}");
            }
          } finally {
            if (mounted) setLoading(false);
          }
        } else {
          console.log("[Auth] getRedirectResult: no pending redirect (normal page load)");
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error("[Auth] Redirect sign-in failed:", err);
          setLoading(false);
        }
      });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[Auth] onAuthStateChanged:", firebaseUser ? `${firebaseUser.email} (${firebaseUser.uid})` : "signed out");
      setUser(firebaseUser);
      try {
        if (firebaseUser) {
          const p = await fetchOrCreateProfile(firebaseUser);
          setProfile(p);
          // Map this IP to the logged-in user so anonymous feedback history is linked
          try {
            const { httpsCallable } = await import("firebase/functions");
            const { getAppFunctions } = await import("@/lib/functions");
            const functions = getAppFunctions();
            if (functions) {
              await httpsCallable(functions, "mapIpToUser")({});
            }
          } catch {
            // non-critical — don't fail auth if this errors
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Auth] Auth profile fetch failed:", err);
        if (msg.includes("permission-denied") || msg.includes("FirebaseError")) {
          console.error("[Auth] Firestore blocked — ensure firestore.rules allow users/{userId} when request.auth.uid == userId");
        }
        setProfile(null);
        // Don't set a fake profile with coolId: null, as it triggers a redirect to /create-id
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const [isSigningIn, setIsSigningIn] = useState(false);

  const signInWithProvider = async (providerType: AuthProviderType) => {
    if (!auth) {
      console.error("[Auth] Firebase not configured");
      throw new Error("Firebase not configured");
    }

    if (isSigningIn) {
      console.log("[Auth] Sign-in already in progress, ignoring");
      return;
    }

    setIsSigningIn(true);
    try {
      let provider;
    switch (providerType) {
      case "google":
        provider = new GoogleAuthProvider();
        break;
      case "facebook":
        provider = new FacebookAuthProvider();
        break;
      case "yahoo":
        provider = new OAuthProvider("yahoo.com");
        break;
      default:
        throw new Error("Unknown provider");
    }

    // Use popup for Google (shows account picker) - fall back to redirect if blocked
    if (providerType === "google") {
      try {
        console.log("[Auth] signInWithProvider(google): opening popup...");
        const cred = await signInWithPopup(auth, provider);
        console.log("[Auth] signInWithProvider(google): popup succeeded", cred.user.email);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const isUserCancelled =
          msg.includes("auth/cancelled-popup-request") || msg.includes("auth/popup-closed-by-user");
        if (msg.includes("auth/popup-blocked") || (msg.includes("popup") && msg.includes("blocked"))) {
          console.log("[Auth] signInWithProvider(google): popup blocked, falling back to redirect");
          await signInWithRedirect(auth, provider);
        } else if (isUserCancelled) {
          throw err; // UI will show friendly "Sign-in cancelled" message
        } else {
          console.warn("[Auth] signInWithProvider(google): popup failed", err);
          throw err;
        }
      }
    } else {
      console.log("[Auth] signInWithProvider(" + providerType + "): redirecting...");
      await signInWithRedirect(auth, provider);
    }
    } finally {
      setIsSigningIn(false);
    }
  };

  const signOut = async () => {
    console.log("[Auth] signOut called");
    if (auth) await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    isSigningIn,
    isConfigured: !!auth,
    signInWithGoogle: () => signInWithProvider("google"),
    signInWithFacebook: () => signInWithProvider("facebook"),
    signInWithYahoo: () => signInWithProvider("yahoo"),
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
