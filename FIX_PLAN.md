# Plan de Corrección de Build

## Estado Actual
La aplicación no compila debido a errores de importación y tipos TypeScript tras la actualización de los componentes `Trading` y `Portfolio`.

## Errores Identificados
1. **Importaciones Incorrectas en `src/pages/app.tsx`**
   - Error: `Export default doesn't exist in target module`
   - Causa: Se usa `import Trading from ...` (default) en lugar de `import { Trading } from ...` (named).

2. **Tipos Faltantes en `src/lib/dataService.ts`**
   - Error: `Property 'tokens' does not exist on type 'Holding'`
   - Causa: La interfaz `Holding` no define la relación con la tabla `tokens` (join), aunque los datos sí vienen de Supabase.

## Pasos de Ejecución (Para Modo Estándar)

### 1. Corregir `src/pages/app.tsx`
Cambiar las importaciones para usar destructuring:
```typescript
// Antes
import Portfolio from "@/components/Portfolio";
import Trading from "@/components/Trading";

// Después
import { Portfolio } from "@/components/Portfolio";
import { Trading } from "@/components/Trading";
```

### 2. Actualizar `src/lib/dataService.ts`
Actualizar la interfaz `Holding` para incluir la propiedad opcional `tokens`:
```typescript
export interface Holding {
  id: string;
  user_id: string;
  token_id: string;
  amount: number;
  avg_buy_price: number;
  created_at?: string;
  updated_at?: string;
  tokens?: Token; // Propiedad necesaria para el join
}
```

### 3. Verificación
- Ejecutar `check_for_errors` para confirmar que la build pasa.
- Verificar visualmente en `/app` que aparecen las pestañas de Swap.