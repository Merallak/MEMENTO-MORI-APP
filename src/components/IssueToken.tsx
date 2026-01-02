import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { DataService } from "@/lib/dataService";
import { uploadTokenImage } from "@/services/storageService";
import { TrendingUp, Upload, Link as LinkIcon } from "lucide-react";

export function IssueToken() {
  const [formData, setFormData] = useState({
    ticker: "",
    name: "",
    description: "",
    image_url: "",
    netWorth: "",
    totalSupply: "",
    basePrice: "",
  });
  const [existingToken, setExistingToken] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadMethod, setUploadMethod] = useState<"file" | "url">("file");
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Check if user already has a token
  useEffect(() => {
    const checkExistingToken = async () => {
      if (!user) return;
      const token = await DataService.getUserIssuedToken(user.id);
      if (token) {
        setExistingToken(token);
        setFormData({
          ticker: token.ticker,
          name: token.name,
          description: token.description || "",
          image_url: token.image_url || "",
          netWorth: token.net_worth.toString(),
          totalSupply: token.total_supply.toString(),
          basePrice: token.current_price.toString(),
        });
        if (token.image_url) {
          setImagePreview(token.image_url);
          setUploadMethod("url");
        }
      }
    };
    checkExistingToken();
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación básica en cliente
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: t("error"),
        description: "La imagen es demasiado grande. Máximo 2MB.",
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);

    // Vista previa
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setFormData((prev) => ({ ...prev, image_url: "" })); // Limpiar URL si había
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: t("error"),
        description: t("mustBeLoggedIn"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let finalImageUrl = formData.image_url;

      // Si el usuario cargó un archivo, subirlo primero
      if (imageFile && uploadMethod === "file") {
        const uploadResult = await uploadTokenImage(imageFile, user.id);

        if (!uploadResult.success) {
          toast({
            title: t("error"),
            description: uploadResult.error || "Error al subir la imagen",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        finalImageUrl = uploadResult.url || "";
      }

      if (existingToken) {
        // Update existing token (only safe fields)
        const result = await DataService.updateToken(existingToken.id, user.id, {
          name: formData.name,
          description: formData.description,
          image_url: finalImageUrl,
          net_worth: parseFloat(formData.netWorth),
        });

        if (result) {
          toast({
            title: t("success"),
            description: t("tokenUpdatedSuccess"),
          });
          setExistingToken(result);
        } else {
          toast({
            title: t("error"),
            description: t("tokenUpdateFailed"),
            variant: "destructive",
          });
        }
      } else {
        // Create new token
        const result = await DataService.createToken({
          ticker: formData.ticker.toUpperCase(),
          name: formData.name,
          description: formData.description,
          image_url: finalImageUrl,
          net_worth: parseFloat(formData.netWorth),
          total_supply: parseFloat(formData.totalSupply),
          current_price: parseFloat(formData.basePrice),
          issuer_id: user.id,
        });

        if (result) {
          toast({
            title: t("success"),
            description: t("tokenIssuedSuccess"),
          });
          setExistingToken(result);
        } else {
          toast({
            title: t("error"),
            description: t("tokenIssueFailed"),
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error issuing/updating token:", error);
      toast({
        title: t("error"),
        description: t("unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setImageFile(null);
    }
  };

  // Calculate initial valuation
  const initialValuation =
    parseFloat(formData.totalSupply) * parseFloat(formData.basePrice);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          {existingToken ? t("updateToken") : t("issueToken")}
        </h2>
        <p className="text-muted-foreground">
          {existingToken ? t("editYourToken") : t("createNewToken")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ticker">{t("market.ticker")}</Label>
            <Input
              id="ticker"
              placeholder="e.g., ELON"
              value={formData.ticker}
              onChange={(e) => handleInputChange("ticker", e.target.value.toUpperCase())}
              disabled={!!existingToken}
              required
              maxLength={5}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">{t("issue.token_name")}</Label>
            <Input
              id="name"
              placeholder="e.g., Elon Musk Personal Token"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              required
              className="bg-background"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t("issue.description")}</Label>
          <Textarea
            id="description"
            placeholder={t("issue.description_placeholder")}
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            required
            rows={3}
            className="bg-background"
          />
        </div>

        {/* Image Upload Section */}
        <div className="space-y-3">
          <Label htmlFor="token-image">{t("issue.token_image")}</Label>

          {/* Method Toggle */}
          <div className="flex gap-2 mb-3">
            <Button
              type="button"
              variant={uploadMethod === "file" ? "default" : "outline"}
              size="sm"
              onClick={() => setUploadMethod("file")}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {t("issue.upload_file")}
            </Button>
            <Button
              type="button"
              variant={uploadMethod === "url" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setUploadMethod("url");
                setImageFile(null);
                setImagePreview("");
              }}
              className="flex items-center gap-2"
            >
              <LinkIcon className="w-4 h-4" />
              {t("issue.paste_url")}
            </Button>
          </div>

          {/* File Upload */}
          {uploadMethod === "file" && (
            <div className="space-y-3">
              <Input
                id="token-image"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={handleImageFileChange}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                {t("issue.image_hint")} (JPG, PNG, WebP, GIF. Max 2MB)
              </p>

              {/* Preview */}
              {imagePreview && (
                <div className="mt-3">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-lg border-2 border-border"
                  />
                </div>
              )}
            </div>
          )}

          {/* URL Input */}
          {uploadMethod === "url" && (
            <div className="space-y-3">
              <Input
                id="token-image-url"
                type="url"
                placeholder="https://example.com/image.png"
                value={formData.image_url}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, image_url: e.target.value }))
                }
              />
              {formData.image_url && (
                <div className="mt-3">
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-lg border-2 border-border"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder-token.png";
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="netWorth">{t("issue.net_worth")}</Label>
            <Input
              id="netWorth"
              type="number"
              step="0.01"
              placeholder="1000000"
              value={formData.netWorth}
              onChange={(e) => handleInputChange("netWorth", e.target.value)}
              required
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalSupply">{t("issue.total_supply")}</Label>
            <Input
              id="totalSupply"
              type="number"
              step="1"
              placeholder="1000000"
              value={formData.totalSupply}
              onChange={(e) => handleInputChange("totalSupply", e.target.value)}
              disabled={!!existingToken}
              required
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="basePrice">{t("issue.initial_price")}</Label>
            <Input
              id="basePrice"
              type="number"
              step="0.01"
              placeholder="1.00"
              value={formData.basePrice}
              onChange={(e) => handleInputChange("basePrice", e.target.value)}
              disabled={!!existingToken}
              required
              className="bg-background"
            />
          </div>
        </div>

        {!existingToken && !isNaN(initialValuation) && initialValuation > 0 && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              {t("issue.initial_valuation")}: <strong>${initialValuation.toLocaleString()}</strong>
            </AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting
            ? existingToken
              ? t("updating")
              : t("issuing")
            : existingToken
            ? t("updateToken")
            : t("issueToken")}
        </Button>
      </form>
    </div>
  );
}