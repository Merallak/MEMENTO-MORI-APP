import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { MarketOverview } from "@/components/MarketOverview";
import { IssueToken } from "@/components/IssueToken";
import { Portfolio } from "@/components/Portfolio";
import { Trading } from "@/components/Trading";
import { Payments } from "@/components/Payments";
import { ChatBot } from "@/components/ChatBot";
import { GameRoom } from "@/components/GameRoom/GameRoom";
import { Profile } from "@/components/Profile";
import AuthModal from "@/components/AuthModal";
import {
  Store,
  PlusCircle,
  Wallet,
  TrendingUp,
  ArrowLeftRight,
  ArrowLeft,
  LogOut,
  Swords,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AppPage() {
  const { user, profile, signOut, loading } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [showAuth, setShowAuth] = useState(false);
  const [activeTab, setActiveTab] = useState("market");

  useEffect(() => {
    if (router.query.login === "true" && !user) {
      setShowAuth(true);
    }
  }, [router.query, user]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-gradient-to-br dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 transition-colors duration-300">
      <header className="border-b border-stone-200 dark:border-stone-800/50 bg-white/80 dark:bg-stone-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              {/* Lógica: Si hay usuario, mostrar Avatar del perfil. Si no, mostrar Logo App */}
              {user ? (
                <Avatar className="h-8 w-8 cursor-pointer" onClick={() => setActiveTab("profile")}>
                  <AvatarImage src={profile?.avatar_url || ""} className="object-cover" />
                  <AvatarFallback className="bg-primary/20 text-xs">
                    {user.email?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden relative">
                  <Image
                    src="/MEMENTO_MORI_APP_4.jpeg"
                    alt={t("landing.title")}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              
              <span className="font-bold text-lg hidden sm:block">
                {t("landing.title")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitch />
            <ThemeSwitch />
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end mr-2">
                  <span className="text-sm font-medium">{user.email}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("nav.logout")}</span>
                </Button>
              </div>
            ) : (
              <Button onClick={() => setShowAuth(true)}>
                {t("auth.sign_in")}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:p-6 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-stone-100 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800/50 flex flex-nowrap overflow-x-auto whitespace-nowrap justify-start">
            <TabsTrigger
              value="market"
              className="shrink-0 whitespace-nowrap data-[state=active]:bg-white dark:data-[state=active]:bg-amber-900/30 data-[state=active]:shadow-sm"
            >
              <Store className="mr-2 h-4 w-4" />
              {t("nav.market")}
            </TabsTrigger>

            <TabsTrigger
              value="issue"
              className="shrink-0 whitespace-nowrap data-[state=active]:bg-white dark:data-[state=active]:bg-amber-900/30 data-[state=active]:shadow-sm"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {t("nav.issue")}
            </TabsTrigger>

            <TabsTrigger
              value="portfolio"
              className="shrink-0 whitespace-nowrap data-[state=active]:bg-white dark:data-[state=active]:bg-amber-900/30 data-[state=active]:shadow-sm"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {t("nav.portfolio")}
            </TabsTrigger>

            <TabsTrigger
              value="trading"
              className="shrink-0 whitespace-nowrap data-[state=active]:bg-white dark:data-[state=active]:bg-amber-900/30 data-[state=active]:shadow-sm"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              {t("nav.trading")}
            </TabsTrigger>

            <TabsTrigger
              value="payments"
              className="shrink-0 whitespace-nowrap data-[state=active]:bg-white dark:data-[state=active]:bg-amber-900/30 data-[state=active]:shadow-sm"
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              {t("nav.payments")}
            </TabsTrigger>

            <TabsTrigger
              value="gameroom"
              className="shrink-0 whitespace-nowrap data-[state=active]:bg-white dark:data-[state=active]:bg-amber-900/30 data-[state=active]:shadow-sm"
            >
              <Swords className="mr-2 h-4 w-4" />
              {t("game_room.title")}
            </TabsTrigger>

            <TabsTrigger
              value="profile"
              className="shrink-0 whitespace-nowrap data-[state=active]:bg-white dark:data-[state=active]:bg-amber-900/30 data-[state=active]:shadow-sm"
            >
              <User className="mr-2 h-4 w-4" />
              {t("nav.profile")}
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              <TabsContent value="market" className="m-0 outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <MarketOverview />
                </motion.div>
              </TabsContent>

              <TabsContent value="issue" className="m-0 outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <IssueToken />
                </motion.div>
              </TabsContent>

              <TabsContent value="portfolio" className="m-0 outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <Portfolio />
                </motion.div>
              </TabsContent>

              <TabsContent value="trading" className="m-0 outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <Trading />
                </motion.div>
              </TabsContent>

              <TabsContent value="payments" className="m-0 outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <Payments />
                </motion.div>
              </TabsContent>

              <TabsContent value="gameroom" className="m-0 outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <GameRoom />
                </motion.div>
              </TabsContent>

              <TabsContent value="profile" className="m-0 outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <Profile />
                </motion.div>
              </TabsContent>
            </AnimatePresence>
          </div>
        </Tabs>
      </main>

      <ChatBot />
      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </div>
  );
}