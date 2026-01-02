# Plan de Economía Híbrida: USD + Token Swaps

## 1. Cambios en Base de Datos (Schema)

### A. Perfiles (Billetera USD)
Agregar soporte para saldo en moneda fiduciaria.

```sql
ALTER TABLE profiles 
ADD COLUMN usd_balance numeric NOT NULL DEFAULT 0;
```

### B. Órdenes (Multi-Moneda)
Permitir que una orden especifique en qué moneda (o token) se solicita el pago.

```sql
ALTER TABLE orders 
ADD COLUMN payment_token_id uuid REFERENCES tokens(id);

-- Comentario: 
-- payment_token_id IS NULL -> Pago en USD
-- payment_token_id IS NOT NULL -> Pago en Token específico (Swap)
```

## 2. Flujos de Usuario

### A. Depósito de Fondos (Simulado)
1. Usuario va a "Portfolio".
2. Clic en "Depositar USD".
3. Modal simple para ingresar monto (simula pasarela de pago).
4. Actualiza `profiles.usd_balance`.

### B. Crear Orden de Swap (Maker)
Usuario A quiere vender su Token "ELON" pero quiere recibir Token "VITA" a cambio.
1. Va a Trading -> Pestaña "Vender".
2. Selecciona Token: "ELON".
3. En "Recibir a cambio de": Selecciona "Otro Token" -> Busca "VITA".
4. Define Precio: 0.5 (Quiere 0.5 VITA por cada 1 ELON).
5. Se crea orden: `type='sell'`, `token_id=ELON`, `payment_token_id=VITA`, `price=0.5`.

### C. Aceptar Oferta de Swap (Taker)
Usuario B tiene Token "VITA" y ve la oferta de Usuario A.
1. Ve la orden en el libro: "Vende ELON a cambio de VITA".
2. Clic en "Comprar/Swappear".
3. Sistema verifica si Usuario B tiene saldo suficiente de "VITA".
4. Ejecuta intercambio atómico de activos.

## 3. Lógica de Seguridad (RLS & Policies)
- Asegurar que nadie pueda modificar su propio `usd_balance` directamente vía API (solo funciones de base de datos seguras).
- Validar que en un Swap, ambos usuarios tengan los fondos necesarios antes de ejecutar.

## 4. Estrategia de Implementación
1. **Fase 1 (Backend):** Ejecutar migraciones SQL para `usd_balance` y `payment_token_id`.
2. **Fase 2 (Frontend - Portfolio):** Implementar UI de balance y depósito.
3. **Fase 3 (Frontend - Trading):** Adaptar `Trading.tsx` para soportar selector de moneda y lógica de Swaps.