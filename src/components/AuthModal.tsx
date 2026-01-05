import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Skull } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  // Form States
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      toast({
        title: t("common.success"),
        description: t("auth.loginTitle"),
      });
      onOpenChange(false);
      setEmail("");
      setPassword("");
    } catch (error: any) {
      console.error("❌ Login error:", error);
      toast({
        title: t("common.error"),
        description: error?.message ?? t("unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Nota: `signUp` del AuthContext existe pero aquí se usa supabase directo; lo respetamos.
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/update-password`,
        },
      });

      if (error) throw error;

      toast({
        title: t("auth.verify_email_title"),
        description: t("auth.verify_email_message"),
      });

      setEmail("");
      setPassword("");
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error?.message ?? t("unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;

      toast({
        title: t("auth.reset_success"),
        description: t("auth.reset_email_sent"),
      });

      setShowForgotPassword(false);
      setEmail("");
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error?.message ?? t("unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-card border-border shadow-2xl">
        <DialogHeader className="flex flex-col items-center text-center pb-2">
          <div className="p-3 rounded-full bg-primary/10 mb-4">
            <Skull className="h-8 w-8 text-primary" />
          </div>

          <DialogTitle className="text-3xl font-serif font-bold tracking-tight text-foreground">
            {t("landing.title")}
          </DialogTitle>

          <DialogDescription className="text-muted-foreground text-base mt-2">
            {t("landing.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Tabs
            value={authMode}
            onValueChange={(v) => setAuthMode(v as "login" | "signup")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t("auth.sign_in")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth.sign_up")}</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">{t("auth.email")}</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">{t("auth.password")}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    {t("auth.forgotPassword")}
                  </button>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("auth.signing_in") : t("auth.sign_in")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-email">{t("auth.email")}</Label>
                  <Input
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">{t("auth.password")}</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("auth.signing_up") : t("auth.sign_up")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {showForgotPassword && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="text-lg font-medium">{t("auth.resetPassword")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("auth.reset_desc")}
              </p>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">{t("auth.email")}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("auth.sending") : t("auth.send_link")}
                </Button>
              </form>

              <Button
                variant="outline"
                onClick={() => setShowForgotPassword(false)}
                className="w-full"
              >
                {t("auth.back_to_login")}
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground/60 uppercase tracking-widest font-mono">
            {t("brand.protocol")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}