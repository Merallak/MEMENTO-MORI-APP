import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMyProfile, updateMyProfile, type ProfileRow } from "@/services/profileService";
import { uploadAvatarImage } from "@/services/storageService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Camera, Loader2 } from "lucide-react";

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function Profile() {
  const { user, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Referencia al input oculto
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const p = await getMyProfile(user.id);

      if (!mounted) return;
      setProfile(p);
      setFullName(p?.full_name ?? "");
      setAvatarUrl(p?.avatar_url ?? "");
      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setUploading(true);
    try {
      // 1. Subir imagen
      const result = await uploadAvatarImage(file, user.id);
      
      if (result.success && result.url) {
        setAvatarUrl(result.url);

        // 2. Actualizar perfil
        await updateMyProfile({
          userId: user.id,
          fullName: fullName || null,
          avatarUrl: result.url,
        });

        // 3. Refrescar estado global
        await refreshProfile();

        toast({ title: t("common.success"), description: t("profile.upload_success") });
      } else {
        toast({ 
          title: t("common.error"), 
          description: result.error || t("profile.upload_error"), 
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error(error);
      toast({ title: t("common.error"), description: t("profile.upload_error"), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSave = async () => {
    if (!user?.id) return;

    const name = fullName.trim();
    const avatar = avatarUrl.trim();

    if (name.length > 120) {
      toast({ title: t("common.error"), description: t("profile.update_error"), variant: "destructive" });
      return;
    }

    if (avatar.length > 0 && (!isValidHttpUrl(avatar) || avatar.length > 2048)) {
      toast({ title: t("common.error"), description: t("profile.avatar_url_invalid"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const updated = await updateMyProfile({
        userId: user.id,
        fullName: name.length ? name : null,
        avatarUrl: avatar.length ? avatar : null,
      });

      setProfile(updated);
      await refreshProfile();

      toast({ title: t("common.success"), description: t("profile.update_success") });
    } catch {
      toast({ title: t("common.error"), description: t("profile.update_error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <div className="text-sm text-muted-foreground">{t("mustBeLoggedIn")}</div>;
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  if (!profile) {
    return <div className="text-sm text-muted-foreground">{t("profile.not_found")}</div>;
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("profile.title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          
          <div className="flex flex-col items-center gap-4">
            {/* OPCIÓN 1: Click en el Avatar (mantenemos el hover effect) */}
            <div 
              className="relative group cursor-pointer" 
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <Avatar className="h-24 w-24 border-2 border-border">
                <AvatarImage src={avatarUrl} className="object-cover" />
                <AvatarFallback className="text-2xl bg-muted">
                  {fullName ? fullName.substring(0, 2).toUpperCase() : user.email?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </div>
              
              {/* Input oculto compartido */}
              <Input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>
            
            {/* OPCIÓN 2: Botón explícito */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              {t("profile.upload_image")}
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-email">{t("auth.email")}</Label>
            <Input id="profile-email" value={user.email ?? ""} readOnly className="bg-muted" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-full-name">{t("auth.fullName")}</Label>
            <Input
              id="profile-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-avatar-url">{t("profile.avatar_url")}</Label>
            <Input
              id="profile-avatar-url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder={t("profile.avatar_url_placeholder")}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={saving || uploading}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.balances_title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t("profile.usd_balance")}</span>
            <span className="font-medium">{String(profile.usd_balance)}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t("profile.mmc_balance")}</span>
            <span className="font-medium">{String(profile.mmc_balance ?? 0)}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t("profile.has_exchanged_equity")}</span>
            <span className="font-medium">
              {profile.has_exchanged_equity ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}