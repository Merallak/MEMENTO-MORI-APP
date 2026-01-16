import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { getMyProfile, type ProfileRow } from "@/services/profileService"; // Importamos servicio

interface AuthContextType {
  user: User | null;
  profile: ProfileRow | null; // Nuevo estado global
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>; // Nueva función para forzar actualización
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null); // Estado del perfil
  const [loading, setLoading] = useState(true);

  // Función para obtener/actualizar perfil
  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    try {
      const data = await getMyProfile(user.id);
      setProfile(data);
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
  }, [user]);

  // Efecto para cargar perfil cuando cambia el usuario
  useEffect(() => {
    refreshProfile();
  }, [user, refreshProfile]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
          console.log("🔐 Session restored:", session.user.id);
          setUser(session.user);
          
          // Self-healing: Ensure profile exists
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ 
              id: session.user.id,
              email: session.user.email,
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          
          if (profileError) {
             console.log("⚠️ Could not verify profile:", profileError.message);
          }
        } else {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔐 Auth state changed:", event, session?.user?.id || "No user");
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setUser(session?.user ?? null);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null); // Limpiar perfil al salir
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
        data: { full_name: fullName },
      },
    });

    if (error) throw error;

    if (data.user) {
      // Create profile record
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
    setUser(data.user);
    // El useEffect de [user] se encargará de cargar el perfil
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
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