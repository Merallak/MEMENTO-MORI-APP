import { useState, useEffect } from "react";
import { DataService, Holding } from "@/lib/dataService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Wallet, TrendingUp, DollarSign, Package, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Portfolio() {
  const { language, t } = useLanguage();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [balance, setBalance] = useState(0);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(true);

  useEffect(() => {
    if (user) {
      loadPortfolioData();
      checkDeleteEligibility();
    }
  }, [user]);

  const loadPortfolioData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const userBalance = await DataService.getUserBalance(user.id);
      const userHoldings = await DataService.getUserHoldings(user.id);
      
      setBalance(userBalance);
      setHoldings(userHoldings);
      
      // Calculate total value
      const holdingsValue = userHoldings.reduce((sum, holding) => {
        return sum + (holding.amount * (holding.tokens?.current_price || 0));
      }, 0);
      
      setTotalValue(userBalance + holdingsValue);
    } catch (error) {
      console.error("Error loading portfolio", error);
    } finally {
      setLoading(false);
    }
  };

  const checkDeleteEligibility = async () => {
    if (!user) return;
    
    setCheckingEligibility(true);
    try {
      const { canDelete } = await DataService.canDeleteAccount(user.id);
      setCanDelete(canDelete);
    } catch (error) {
      console.error("Error checking eligibility", error);
      setCanDelete(false);
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleDeposit = async () => {
    if (!user || !depositAmount) return;

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t("common.error"),
        description: t("common.required"),
        variant: "destructive",
      });
      return;
    }

    const success = await DataService.depositUsd(user.id, amount);
    
    if (success) {
      await loadPortfolioData();
      setDepositAmount("");
      setIsDepositOpen(false);
      toast({
        title: t("common.success"),
        description: `$${amount.toFixed(2)} deposited`,
      });
    } else {
      toast({
        title: t("common.error"),
        description: "Deposit failed",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE" || !user) return;
    
    setIsDeleting(true);
    
    try {
      await DataService.deleteAccount(user.id);
      // Auth change will trigger redirect in Layout/Context usually, 
      // but we force signout and redirect here
      await signOut();
      
      toast({
        title: t("common.success"),
        description: t("auth.noAccount"), // Fallback or appropriate message
      });
      
      router.push("/");
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || "Failed to delete account",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-border/50 bg-card shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{t("portfolio.title")}</CardTitle>
            <CardDescription>{t("portfolio.total_value")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg"
              >
                <TrendingUp className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("portfolio.total_value")}</p>
                  <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg"
              >
                <DollarSign className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("trading.labels.balance")}</p>
                  <p className="text-2xl font-bold">${balance.toFixed(2)}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg"
              >
                <Package className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("landing.stats.tokens")}</p>
                  <p className="text-2xl font-bold">{holdings.length}</p>
                </div>
              </motion.div>
            </div>

            <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Wallet className="mr-2 h-4 w-4" />
                  {t("portfolio.value")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card">
                <DialogHeader>
                  <DialogTitle>{t("portfolio.value")}</DialogTitle>
                  <DialogDescription>
                    Enter the amount you want to deposit
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (USD)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="1000.00"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <Button onClick={handleDeposit} className="w-full">
                    {t("common.confirm")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t("portfolio.tokens")}</h3>
              {holdings.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <Package className="w-16 h-16 mx-auto text-muted-foreground opacity-50" />
                  <div>
                    <p className="text-lg font-semibold">{t("portfolio.no_holdings")}</p>
                  </div>
                  <Button onClick={() => router.push("/app")}>
                    {t("nav.market")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {holdings.map((holding) => {
                    const token = holding.tokens;
                    if (!token) return null;
                    
                    return (
                      <motion.div
                        key={holding.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={holding.tokens?.image_url || ""} className="object-cover" />
                            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                              {holding.tokens?.ticker.substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{token.ticker}</p>
                            <p className="text-sm text-muted-foreground">{token.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{holding.amount.toLocaleString()} {t("market.ticker")}</p>
                          <p className="text-sm text-muted-foreground">
                            {t("portfolio.value")}: ${(holding.amount * token.current_price).toFixed(2)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-destructive/20">
              <Card className="border-destructive/50 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {t("common.delete")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-destructive mb-2">{t("common.delete")}</h4>
                    {!canDelete && !checkingEligibility && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Cannot Delete Account</AlertTitle>
                        <AlertDescription>
                          Holdings must be empty
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        disabled={!canDelete || checkingEligibility}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {checkingEligibility ? t("common.loading") : t("common.delete")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">
                          {t("common.delete")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="confirmDelete">Type DELETE</Label>
                          <Input
                            id="confirmDelete"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="DELETE"
                            className="bg-background font-mono"
                          />
                        </div>
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          disabled={deleteConfirmText !== "DELETE" || isDeleting}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t("common.delete")}
                            </>
                          ) : (
                            t("common.confirm")
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}