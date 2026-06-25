import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { UserProfile, UserRole } from "../types";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  loginAsDemo: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [demoProfile, setDemoProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem("demoProfile");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      if (!auth || !db) {
        console.error("Firebase auth/db is missing.");
        setLoading(false);
        return;
      }
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        try {
          setCurrentUser(user);

          if (user) {
            // Fetch or create user profile
            const userRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(userRef);

            if (docSnap.exists()) {
              setUserProfile(docSnap.data() as UserProfile);
            } else {
              const newProfile: UserProfile = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                role: "caregiver",
              };
              await setDoc(userRef, newProfile);
              setUserProfile(newProfile);
            }
          } else {
            setUserProfile(null);
          }
        } catch (err) {
          console.error("Auth sync error", err);
        }

        setLoading(false);
      });
    } catch (err) {
      console.error("Auth effect error", err);
      setLoading(false);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const loginAsDemo = (role: UserRole) => {
    const nameMap = {
      caregiver: "Demo Caregiver",
      rn: "Demo RN",
      manager: "Demo Manager",
      admin: "Demo Admin",
    };
    const profile: UserProfile = {
      uid: `demo-${role}`,
      email: `${role}@demo.com`,
      displayName: nameMap[role],
      role: role,
    };
    localStorage.setItem("demoProfile", JSON.stringify(profile));
    setDemoProfile(profile);
  };

  const logout = async () => {
    if (demoProfile) {
      localStorage.removeItem("demoProfile");
      setDemoProfile(null);
    } else {
      return signOut(auth);
    }
  };

  const activeProfile = demoProfile || userProfile;
  const activeUser = demoProfile
    ? ({ uid: demoProfile.uid, email: demoProfile.email } as any)
    : currentUser;

  const value = {
    currentUser: activeUser,
    userProfile: activeProfile,
    loading,
    logout,
    loginAsDemo,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
