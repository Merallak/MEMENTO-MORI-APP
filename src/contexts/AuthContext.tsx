import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on mount and refresh it
    const initializeAuth = async () => {
      try {
        // Check for active session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (session) {
          console.log("🔐 Session restored:", session.user.id);
          setUser(session.user);
          
          // SELF-HEALING: Ensure profile exists
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ 
              id: session.user.id,
              email: session.user.email,
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          
          if (profileError) {
             console.log("⚠️ Could not verify profile:", profileError.message);
          } else {
             console.log("✅ Profile verified/created for user");
          }
        } else {
          console.log("ℹ️ No active session found");
          setUser(null);
        }
      } catch (error) {
        console.error("❌ Error initializing auth:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔐 Auth state changed:", event, session?.user?.id || "No user");
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setUser(session?.user ?? null);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        } else {
          setUser(session?.user ?? null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) throw error;

    // Create profile record
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          email: data.user.email!,
          full_name: fullName,
        });

      if (profileError && profileError.code !== '23505') {
        console.error("Profile creation error:", profileError);
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    console.log("✅ Sign in successful, user ID:", data.user?.id);
    
    // Explicitly set the user after sign in
    setUser(data.user);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    console.log("👋 Signed out");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};