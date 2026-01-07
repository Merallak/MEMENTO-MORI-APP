import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMyProfile, updateMyProfile, type ProfileRow } from "@/services/profileService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function Profile() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

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
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="profile-email">{t("auth.email")}</Label>
            <Input id="profile-email" value={user.email ?? ""} readOnly />
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
            <Button onClick={onSave} disabled={saving}>
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