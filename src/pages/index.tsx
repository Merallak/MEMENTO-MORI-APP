import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowRight, LogIn, Users, Coins, TrendingUp, Skull, Shield, Sparkles, Globe, Github, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal from "@/components/AuthModal";
import { DataService } from "@/lib/dataService";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChatBot } from "@/components/ChatBot";

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [stats, setStats] = useState({
    users: 0,
    tokens: 0,
    marketCap: 0
  });

  const loadStats = async () => {
    const users = await DataService.getUsers();
    const tokens = await DataService.getAllTokens();
    const totalValuation = tokens.reduce((acc, token) => acc + token.market_cap, 0);

    setStats({
      users: users.length,
      tokens: tokens.length,
      marketCap: totalValuation
    });
  };

  useEffect(() => {
    DataService.initializeDemoData();
    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleEnterApp = () => {
    if (user) {
      router.push("/app");
    } else {
      setIsAuthOpen(true);
    }
  };

  const features = [
    {
      icon: Skull,
      title: t('landing.features.issue_title'),
      description: t('landing.features.issue_desc'),
      color: "text-copper"
    },
    {
      icon: Coins,
      title: t('landing.features.trade_title'),
      description: t('landing.features.trade_desc'),
      color: "text-foreground"
    },
    {
      icon: TrendingUp,
      title: t('landing.features.valuation_title'),
      description: t('landing.features.valuation_desc'),
      color: "text-copper"
    },
    {
      icon: Shield,
      title: t('landing.features.security_title'),
      description: t('landing.features.security_desc'),
      color: "text-foreground"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 transition-colors duration-300">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-6 bg-background/80 backdrop-blur-md border-b border-border/50 transition-all duration-300">
        <div className="flex items-center gap-3">
           <div className="relative w-8 h-8 rounded-full bg-primary flex items-center justify-center overflow-hidden">
             <Image src="/MEMENTO_MORI_APP_4.jpeg" alt="Memento Mori" fill className="object-cover" />
           </div>
          <span className="text-xl font-bold tracking-tighter text-foreground font-serif">MEMENTO MORI</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeSwitch />
          <LanguageSwitch />
          <Button 
            variant="ghost" 
            className="text-muted-foreground hover:text-foreground hidden sm:inline-flex"
            onClick={() => window.open('https://github.com', '_blank')}
          >
            {t('nav.github')}
          </Button>
          <Button 
            onClick={handleEnterApp}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105"
          >
            {user ? t('nav.go_to_app') : t('nav.connect')}
          </Button>
        </div>
      </nav>

      <main className="flex flex-col items-center justify-center min-h-screen p-4 pt-28 relative overflow-hidden">
        
        {/* Background Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Hero Section */}
        <div className="z-10 flex flex-col items-center text-center max-w-4xl w-full space-y-12">
          
          {/* Main Visual */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative w-full max-w-[360px] aspect-[4/5] rounded-xl overflow-hidden shadow-2xl shadow-primary/10 border border-border group mx-auto"
          >
            <Image 
              src="/MEMENTO_MORI_APP_4.jpeg" 
              alt="Memento Mori Skull" 
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-30" />
            <div className="absolute inset-0 border border-primary/20 rounded-xl pointer-events-none" />
          </motion.div>

          {/* Typography */}
          <div className="space-y-6">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-7xl font-bold tracking-tighter text-foreground font-serif leading-tight"
            >
              MEMENTO MORI
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xl md:text-2xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed"
            >
              <span className="block text-foreground font-medium mb-3">{t('landing.subtitle')}</span>
              <span className="text-primary font-mono text-lg uppercase tracking-widest opacity-80">{t('landing.tagline')}</span>
            </motion.p>
          </div>

          {/* Call to Action */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row items-center gap-4 pt-4"
          >
            <Button 
              size="lg" 
              className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full shadow-xl shadow-primary/20 transition-all hover:scale-105 hover:-translate-y-1"
              onClick={handleEnterApp}
            >
              <LogIn className="mr-2 h-5 w-5" />
              {t('landing.cta_primary')}
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="h-14 px-8 text-lg rounded-full border-2 hover:bg-muted/50 transition-all"
              onClick={handleEnterApp}
            >
              {t('landing.cta_secondary')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>

          {/* Real Stats Bar */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
          >
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                <Users className="w-4 h-4" />
                <span>{t("landing.stats.users")}</span>
              </div>
              <div className="text-4xl font-bold">{stats.users}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4" />
                <span>{t("landing.stats.tokens")}</span>
              </div>
              <div className="text-4xl font-bold text-[#C17817]">{stats.tokens}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                <Globe className="w-4 h-4" />
                <span>{t("landing.stats.market_cap")}</span>
              </div>
              <div className="text-4xl font-bold text-emerald-500">${stats.marketCap}</div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            {t("landing.how_title")}
          </h2>
          <p className="text-xl text-center text-muted-foreground mb-16">
            {t("landing.how_subtitle")}
          </p>

          {/* Features Grid */}
          <section className="container mx-auto px-4 py-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {[
                {
                  icon: Skull,
                  title: t('landing.features.issue_title'),
                  desc: t('landing.features.issue_desc')
                },
                {
                  icon: TrendingUp,
                  title: t('landing.features.trade_title'),
                  desc: t('landing.features.trade_desc')
                },
                {
                  icon: BarChart3,
                  title: t('landing.features.valuation_title'),
                  desc: t('landing.features.valuation_desc')
                },
                {
                  icon: Shield,
                  title: t('landing.features.security_title'),
                  desc: t('landing.features.security_desc')
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-stone-900/50 backdrop-blur-sm p-8 rounded-xl border border-stone-800 hover:border-orange-500/50 transition-all duration-300"
                >
                  <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-4 rounded-lg w-fit mb-6">
                    <feature.icon className="w-6 h-6 text-stone-950" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                  <p className="text-stone-400 leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section className="container mx-auto px-4 py-24 border-t border-stone-800">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
              {t("landing.how_title")}
            </h2>
            <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
              {t("landing.how_subtitle")}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {[
                {
                  num: "01",
                  title: t('landing.steps.step1_title'),
                  desc: t('landing.steps.step1_desc')
                },
                {
                  num: "02",
                  title: t('landing.steps.step2_title'),
                  desc: t('landing.steps.step2_desc')
                },
                {
                  num: "03",
                  title: t('landing.steps.step3_title'),
                  desc: t('landing.steps.step3_desc')
                },
                {
                  num: "04",
                  title: t('landing.steps.step4_title'),
                  desc: t('landing.steps.step4_desc')
                }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="relative bg-stone-900/50 backdrop-blur-sm p-6 rounded-xl border border-stone-800 hover:border-orange-500/50 transition-all duration-300"
                >
                  <div className="bg-gradient-to-br from-orange-500/20 to-amber-600/20 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 border border-orange-500/30">
                    <span className="text-2xl font-bold text-orange-500">{item.num}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-stone-400 text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-center mt-32 bg-card border border-border rounded-3xl p-12 relative overflow-hidden shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            
            <div className="relative z-10 space-y-8">
              <div className="space-y-4">
                <p className="text-amber-700 dark:text-amber-500 text-sm font-medium tracking-widest">
                  {t("landing.tagline")}
                </p>
                <h1 className="text-5xl md:text-7xl font-bold text-stone-900 dark:text-stone-50 tracking-tight">
                  {t("landing.title")}
                </h1>
              </div>
              <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-3xl mx-auto">
                {t('landing.final_cta_subtitle')}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
                <Button
                  size="lg"
                  onClick={handleEnterApp}
                  className="h-16 px-10 text-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                >
                  <Sparkles className="mr-3 w-6 h-6" />
                  {t('landing.start_now')}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-12 border-t border-stone-800">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4 text-white">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="font-bold text-primary">M</span>
                </div>
                <span className="font-bold text-lg">MEMENTO MORI</span>
              </div>
              <p className="max-w-xs text-sm">
                {t('footer.description')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">{t('nav.market')}</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-primary transition-colors">{t('landing.features.issue_title')}</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">{t('landing.features.trade_title')}</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">{t('landing.features.valuation_title')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">{t('footer.docs')}</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/terms-of-service" className="hover:text-primary transition-colors">{t('footer.terms')}</a></li>
                <li><a href="/privacy-policy" className="hover:text-primary transition-colors">{t('footer.privacy')}</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-stone-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
            <p>© {new Date().getFullYear()} Memento Mori. {t('footer.rights')}</p>
          </div>
        </div>
      </footer>

      <ChatBot />
      <AuthModal 
        open={isAuthOpen} 
        onOpenChange={setIsAuthOpen} 
      />
    </div>
  );
}