# Plan de Migración a Supabase (Multi-usuario Real)

Actualmente, la app usa `localStorage`, lo que impide que los usuarios vean los datos de otros. Este plan detalla los pasos para conectar la app a Supabase.

## 1. Esquema de Base de Datos (Supabase)

Necesitamos crear las siguientes tablas en Supabase.

### Tabla: `public.tokens`
Almacena los tokens emitidos por los usuarios.
- `id` (UUID, PK)
- `issuer_id` (UUID, FK -> profiles.id)
- `name` (Text)
- `ticker` (Text)
- `description` (Text, Opcional)
- `image_url` (Text, Opcional)
- `net_worth` (Numeric) - Patrimonio declarado
- `total_supply` (Numeric) - Suministro total
- `current_price` (Numeric)
- `market_cap` (Numeric)
- `created_at` (Timestamp)

### Tabla: `public.holdings`
Rastrea qué usuarios poseen qué tokens.
- `id` (UUID, PK)
- `user_id` (UUID, FK -> profiles.id)
- `token_id` (UUID, FK -> tokens.id)
- `amount` (Numeric)
- `updated_at` (Timestamp)

### Tabla: `public.orders` (Libro de Órdenes Simplificado)
Registro de compras/ventas.
- `id` (UUID, PK)
- `user_id` (UUID, FK -> profiles.id)
- `token_id` (UUID, FK -> tokens.id)
- `type` (Text: 'buy' | 'sell')
- `amount` (Numeric)
- `price` (Numeric)
- `status` (Text: 'open' | 'filled' | 'cancelled')
- `created_at` (Timestamp)

## 2. Políticas de Seguridad (RLS)

- **Tokens**: Lectura pública (`true`). Escritura solo para el usuario autenticado (Creación).
- **Holdings**: Lectura pública (o privada según preferencia). Escritura solo sistema o usuario propio.
- **Orders**: Lectura pública. Escritura solo usuario propio.

## 3. Actualización de Código (`DataService.ts`)

Reemplazar los métodos actuales que usan `localStorage` por llamadas al cliente de Supabase.

```typescript
// Ejemplo del cambio
// ANTES
getTokens: () => JSON.parse(localStorage.getItem('tokens')),

// DESPUÉS
getTokens: async () => {
  const { data } = await supabase.from('tokens').select('*, profiles(username, avatar_url)');
  return data;
}
```

## 4. Pasos de Ejecución (Para Creative Mode)

1.  **Ejecutar SQL**: Crear tablas y políticas RLS usando `execute_sql_query`.
2.  **Actualizar Tipos**: Generar tipos TypeScript de Supabase.
3.  **Refactorizar Service**: Reescribir `src/lib/dataService.ts` para usar `supabase-js`.
4.  **Actualizar Componentes**: Adaptar componentes (`MarketOverview`, `Portfolio`, `IssueToken`) para manejar promesas/async, ya que Supabase es asíncrono (a diferencia de localStorage que era síncrono).