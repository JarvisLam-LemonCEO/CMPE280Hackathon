import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const AuthContext = createContext({ user: null, profile: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) setProfile(null);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    getDoc(ref).then((snap) => {
      if (!snap.exists()) {
        setDoc(ref, {
          email: user.email,
          displayName: user.email?.split("@")[0] ?? "",
          photoURL: "",
          createdAt: Date.now(),
        });
      }
    });
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setProfile({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [user]);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
