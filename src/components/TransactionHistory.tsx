import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DataService, Trade } from "@/lib/dataService";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface TransactionHistoryProps {
  tokenId?: string;
  limit?: number;
}

export function TransactionHistory({ tokenId, limit = 20 }: TransactionHistoryProps) {
  const { t } = useLanguage();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrades();
    
    // Set up polling for real-time updates (every 10 seconds)
    const interval = setInterval(loadTrades, 10000);
    return () => clearInterval(interval);
  }, [tokenId]);

  const loadTrades = async () => {
    try {
      const data = await DataService.getRecentTrades(tokenId, limit);
      setTrades(data);
    } catch (error) {
      console.error("Failed to load trades", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && trades.length === 0) {
    return (
      <div className="flex justify-center items-center h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {t("trading.history.no_trades")}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">{t("trading.history.price")}</TableHead>
            <TableHead className="text-right">{t("trading.history.amount")}</TableHead>
            <TableHead className="text-right">{t("trading.history.time")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.id}>
              <TableCell className={trade.type === 'BUY' ? 'text-green-500' : 'text-red-500'}>
                ${Number(trade.price_per_token).toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                {Number(trade.amount).toFixed(0)}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(trade.executed_at), { addSuffix: true }).replace("about ", "")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}