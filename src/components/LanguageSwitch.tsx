import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={toggleLanguage}
      className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
    >
      <Languages className="h-4 w-4" />
      <span className="font-medium text-xs">
        {language === 'es' ? 'ES' : 'EN'}
      </span>
    </Button>
  );
}