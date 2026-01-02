import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import QRCode from "react-qr-code";
import { Html5Qrcode } from "html5-qrcode";
import { DataService, Token } from "@/lib/dataService";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  QrCode as QrCodeIcon, 
  Scan, 
  Camera, 
  XCircle, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import { motion } from "framer-motion";

interface PaymentRequest {
  type: "payment_request";
  token: string;
  amount: number;
  recipient: string;
  recipientName: string;
  timestamp: number;
}

export function Payments() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  
  // Request Payment State
  const [myTokens, setMyTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [requestAmount, setRequestAmount] = useState<string>("");
  const [qrData, setQrData] = useState<string>("");
  
  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<PaymentRequest | null>(null);
  const [scanError, setScanError] = useState<string>("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ success: boolean; message: string } | null>(null);
  const [senderBalance, setSenderBalance] = useState<number>(0);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (user) {
      loadMyTokens();
    }
  }, [user]);

  // Effect to handle scanner initialization when isScanning becomes true
  useEffect(() => {
    let scanner: Html5Qrcode | null = null;

    const initScanner = async () => {
      if (isScanning && !scannedData) {
        // Wait a bit for the DOM element to be ready
        await new Promise(r => setTimeout(r, 100));
        
        try {
          // If a scanner instance already exists, stop it first
          if (scannerRef.current) {
            await scannerRef.current.stop().catch(console.error);
          }

          scanner = new Html5Qrcode("qr-reader");
          scannerRef.current = scanner;
          
          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            async (decodedText) => {
              try {
                // Pause scanning immediately upon detection
                if (scanner) {
                   await scanner.pause();
                }

                const data: PaymentRequest = JSON.parse(decodedText);
                
                if (data.type !== "payment_request") {
                  setScanError(t("payments.error_invalid_qr"));
                  if (scanner) await scanner.resume();
                  return;
                }
                
                // Check sender's balance
                if (user) {
                  const holdings = await DataService.getUserHoldings(user.id);
                  const holding = holdings.find(h => h.tokens?.ticker === data.token);
                  setSenderBalance(holding?.amount || 0);
                }
                
                setScannedData(data);
                setIsScanning(false);
                
                // Stop scanner
                if (scanner) {
                    await scanner.stop();
                    scannerRef.current = null;
                }
              } catch (error) {
                console.error("Parse error", error);
                setScanError(t("payments.error_invalid_qr"));
                if (scanner) await scanner.resume();
              }
            },
            (errorMessage) => {
              // Ignore frame errors
            }
          );
        } catch (err) {
          console.error("Camera start error", err);
          setScanError(t("payments.error_camera"));
          setIsScanning(false);
        }
      }
    };

    if (isScanning) {
        initScanner();
    }

    // Cleanup function
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isScanning, user, t, scannedData]);

  const loadMyTokens = async () => {
    if (!user) return;
    
    const holdings = await DataService.getUserHoldings(user.id);
    
    // Get tokens that user owns - Access nested token data safely
    const ownedTokens = holdings
      .map(h => h.tokens) // Get the nested token object
      .filter((t): t is NonNullable<typeof t> => t !== null && t !== undefined); // Filter out nulls
      
    const ownedTickers = ownedTokens.map(t => t.ticker);
    
    const allTokens = await DataService.getAllTokens();
    const owned = allTokens.filter(t => ownedTickers.includes(t.ticker));
    
    setMyTokens(owned);
  };

  const generateQRCode = () => {
    if (!user || !selectedToken || !requestAmount) return;
    
    const amount = parseFloat(requestAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    const token = myTokens.find(t => t.ticker === selectedToken);
    if (!token) return;
    
    const paymentRequest: PaymentRequest = {
      type: "payment_request",
      token: selectedToken,
      amount: amount,
      recipient: user.id,
      recipientName: token.name,
      timestamp: Date.now()
    };
    
    setQrData(JSON.stringify(paymentRequest));
  };

  const startScanning = () => {
    setScanError("");
    setScannedData(null);
    setPaymentResult(null);
    setIsScanning(true);
  };

  const stopScanning = async () => {
    setIsScanning(false);
    // Cleanup is handled by useEffect
  };

  const executePayment = async () => {
    if (!user || !scannedData) return;
    
    setPaymentProcessing(true);
    setPaymentResult(null);
    
    try {
      // Verify sender has sufficient balance
      const holdings = await DataService.getUserHoldings(user.id);
      const holding = holdings.find(h => h.tokens?.ticker === scannedData.token);
      
      if (!holding || holding.amount < scannedData.amount) {
        throw new Error(t("common.error")); // "insufficientBalance" key missing, using generic error
      }
      
      // Execute transfer
      await DataService.transferTokens(
        user.id,
        scannedData.recipient,
        scannedData.token,
        scannedData.amount
      );
      
      setPaymentResult({
        success: true,
        message: t("payments.success")
      });
      
      // Reset scanner data after successful payment
      setTimeout(() => {
        setScannedData(null);
        setPaymentResult(null);
      }, 3000);
      
    } catch (error) {
      setPaymentResult({
        success: false,
        message: error instanceof Error ? error.message : t("common.error")
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <Card className="border-border/50 shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="bg-muted/30 pb-8">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {t("payments.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="-mt-6">
          <Tabs defaultValue="request" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 mb-6">
              <TabsTrigger value="request" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <QrCodeIcon className="mr-2 h-4 w-4" />
                {t("payments.request_payment")}
              </TabsTrigger>
              <TabsTrigger value="scan" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Camera className="mr-2 h-4 w-4" />
                {t("payments.scan_pay")}
              </TabsTrigger>
            </TabsList>

            {/* Request Payment Tab */}
            <TabsContent value="request" className="space-y-6 mt-0">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">
                    {t("payments.request_payment")}
                  </h3>
                </div>

                {myTokens.length === 0 ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {t("portfolio.no_holdings")}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="token-select">
                        {t("trading.select_token")}
                      </Label>
                      <Select value={selectedToken} onValueChange={setSelectedToken}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("trading.select_token")} />
                        </SelectTrigger>
                        <SelectContent>
                          {myTokens.map((token) => (
                            <SelectItem key={token.ticker} value={token.ticker}>
                              {token.ticker} - {token.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="amount">
                        {t("payments.amount")}
                      </Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="100.00"
                        value={requestAmount}
                        onChange={(e) => setRequestAmount(e.target.value)}
                      />
                    </div>

                    <Button
                      onClick={generateQRCode}
                      disabled={!selectedToken || !requestAmount}
                      className="w-full"
                    >
                      <QrCodeIcon className="mr-2 h-4 w-4" />
                      {t("payments.generate_qr")}
                    </Button>

                    {qrData && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="space-y-4 p-6 bg-white rounded-lg shadow-inner mt-4"
                      >
                        <div className="text-center space-y-2">
                          <h4 className="font-semibold text-black">
                            {t("payments.scan_pay")}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {t("payments.scan_to_pay")}
                          </p>
                        </div>
                        <div className="flex justify-center p-4 bg-white rounded-lg">
                          <QRCode value={qrData} size={256} />
                        </div>
                        <div className="text-center text-sm text-gray-600 space-y-1">
                          <p><strong>{t("market.ticker")}:</strong> {selectedToken}</p>
                          <p><strong>{t("payments.amount")}:</strong> {requestAmount}</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* Scan & Pay Tab */}
            <TabsContent value="scan" className="space-y-6 mt-0">
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">
                    {t("payments.scan_pay")}
                  </h3>
                </div>

                {!isScanning && !scannedData && (
                  <Button
                    onClick={startScanning}
                    className="w-full"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {t("payments.start_scanning")}
                  </Button>
                )}

                {isScanning && (
                  <div className="space-y-4">
                    <div className="relative rounded-lg overflow-hidden border-2 border-primary/50 bg-black">
                      <div
                        id="qr-reader"
                        className="w-full min-h-[300px]"
                      />
                      <div className="absolute inset-0 border-2 border-primary/20 pointer-events-none" />
                    </div>
                    <Button
                      onClick={stopScanning}
                      variant="destructive"
                      className="w-full"
                    >
                      {t("payments.stop_scanning")}
                    </Button>
                  </div>
                )}

                {scanError && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{scanError}</AlertDescription>
                  </Alert>
                )}

                {scannedData && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="space-y-4 p-6 bg-muted/50 rounded-lg border border-border"
                  >
                    <h4 className="font-semibold text-primary">
                      {t("payments.confirm_payment")}
                    </h4>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("payments.recipient")}:</span>
                        <span className="text-foreground font-medium">{scannedData.recipientName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("market.ticker")}:</span>
                        <span className="text-foreground font-medium">{scannedData.token}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("payments.amount")}:</span>
                        <span className="text-primary font-bold text-lg">{scannedData.amount}</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2 mt-2">
                        <span className="text-muted-foreground">{t("trading.labels.balance")}:</span>
                        <span className={`font-medium ${senderBalance >= scannedData.amount ? "text-green-500" : "text-destructive"}`}>
                          {senderBalance}
                        </span>
                      </div>
                    </div>

                    {paymentResult && (
                      <Alert variant={paymentResult.success ? "default" : "destructive"} className={paymentResult.success ? "border-green-500 bg-green-950/20" : ""}>
                        {paymentResult.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <AlertDescription className={paymentResult.success ? "text-green-500" : ""}>
                          {paymentResult.message}
                        </AlertDescription>
                      </Alert>
                    )}

                    {!paymentResult && (
                      <Button
                        onClick={executePayment}
                        disabled={paymentProcessing || senderBalance < scannedData.amount}
                        className="w-full"
                      >
                        {paymentProcessing
                          ? t("common.loading")
                          : t("common.confirm")}
                      </Button>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}