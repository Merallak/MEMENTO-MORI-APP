import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skull, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";

export default function UpdatePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Estado para controlar la carga inicial de verificación de sesión
  const [verifying, setVerifying] = useState(true);
  const [isValidSession, setIsValidSession] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    // Escuchar cambios de autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setIsValidSession(true);
        setVerifying(false);
      }
    });

    // Verificación inicial manual
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
        setVerifying(false);
      } else {
        // Si no hay sesión inmediata, damos un breve margen por si el hash se está procesando
        setTimeout(async () => {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (!currentSession) {
            // Solo fallamos si no hay sesión y tampoco parece haber un token en la URL
             if (!window.location.hash.includes("access_token") && !window.location.hash.includes("type=recovery")) {
                setIsValidSession(false);
             }
          } else {
             setIsValidSession(true);
          }
          setVerifying(false);
        }, 1000);
      }
    };

    checkSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Efecto separado para redirigir si falla la verificación
  useEffect(() => {
    if (!verifying && !isValidSession) {
      toast({
        title: t('common.error'),
        description: "Invalid or expired reset link",
        variant: "destructive",
      });
      router.push("/");
    }
  }, [verifying, isValidSession, router, t, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: t('auth.password_updated'),
      });

      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">{t('auth.redirecting')}</p>
        </div>
      </div>
    );
  }

  if (!isValidSession) {
    return null; // El useEffect se encarga de redirigir
  }

  return (
    <>
      <SEO
        title={t('auth.updatePassword') + " | Memento Mori"}
      />
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Skull className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-display font-bold">MEMENTO MORI</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('landing.subtitle')}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <CardTitle>{t('auth.updatePassword')}</CardTitle>
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.newPassword')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-background"
                  placeholder="******"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {loading ? "Updating..." : t('auth.updatePassword')}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button
              variant="link"
              onClick={() => router.push("/")}
              className="text-sm"
            >
              {t('nav.back_home')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}