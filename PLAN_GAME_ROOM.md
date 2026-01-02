# Plan de Implementación: Sala de Juegos (Piedra, Papel, Tijeras)

## 1. Resumen
Implementar un mini-juego de Piedra, Papel o Tijeras (RPS) integrado en la aplicación Memento Mori, permitiendo a los usuarios apostar su saldo (USD Balance) en partidas 1vs1.

## 2. Arquitectura de Datos (Supabase)

### Nueva Tabla: `rps_games`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | Primary Key |
| `host_id` | UUID | FK a `profiles`. Creador de la sala. |
| `guest_id` | UUID | FK a `profiles`. Oponente (nullable al inicio). |
| `bet_amount` | Numeric | Cantidad apostada por CADA jugador. |
| `status` | Text | 'waiting', 'active', 'playing', 'finished', 'cancelled'. |
| `host_move` | Text | 'rock', 'paper', 'scissors' (nullable). |
| `guest_move` | Text | 'rock', 'paper', 'scissors' (nullable). |
| `winner_id` | UUID | FK a `profiles`. ID del ganador o NULL si empate. |
| `created_at` | Timestamp | |
| `expires_at` | Timestamp | Para auto-cancelar salas abandonadas. |

### Seguridad (RLS Policies)
- **Lectura pública**: Todos pueden ver las salas con status 'waiting'.
- **Lectura privada**: Solo los participantes pueden ver una sala 'active' o 'playing'.
- **Ocultamiento de jugadas**: Las columnas `host_move` y `guest_move` solo son visibles cuando `status = 'finished'`.
- **Escritura**: Solo el host puede crear, solo el guest puede unirse.

### Funciones RPC (Supabase)
1. **`create_rps_game(p_bet_amount numeric)`**: Crea partida y descuenta saldo del host.
2. **`join_rps_game(p_game_id uuid)`**: Une al guest y descuenta su saldo.
3. **`submit_move(p_game_id uuid, p_move text)`**: Registra la jugada del usuario actual.
4. **`resolve_rps_game(p_game_id uuid)`**: Determina ganador y distribuye premios (se ejecuta automáticamente cuando ambos tienen jugada).

## 3. Lógica del Juego ("La Casa")

### Flujo de Apuestas (Escrow)
1. **Crear Sala (Host)**:
   - Se descuenta `bet_amount` del `usd_balance` del Host.
   - Si cancela la sala antes de que alguien se una, se le devuelve.
2. **Unirse (Guest)**:
   - Se verifica que el Guest tenga saldo suficiente.
   - Se descuenta `bet_amount` del Guest.
   - Estado cambia a 'active'.
3. **Jugadas**:
   - Ambos envían su jugada (piedra/papel/tijeras).
   - Cuando ambos han jugado, se ejecuta automáticamente la resolución.
4. **Resolución**:
   - Ganador recibe `bet_amount * 2`.
   - Empate: Cada uno recibe `bet_amount`.

## 4. Interfaz de Usuario (Frontend)

### Nueva Pestaña: `GameRoom` (en `src/pages/app.tsx`)
Se añadirá como una nueva `TabsTrigger` y `TabsContent`.

### Componentes Nuevos
1. **`GameLobby.tsx`**:
   - Lista de partidas disponibles (filtro por monto).
   - Botón "Crear Partida".
   - Botón "Jugar con Amigo" (Genera un link o ID para compartir).
2. **`ActiveGame.tsx`**:
   - Estado visual de la partida.
   - Controles: Botones grandes de Piedra, Papel, Tijeras.
   - Feedback: "Esperando oponente...", "Oponente eligió...", "¡Ganaste!".
   - Animación simple con `framer-motion`.

## 5. Pasos de Implementación

### Fase 1: Base de Datos
1. Crear tabla `rps_games` con RLS policies.
2. Crear funciones RPC para seguridad de transacciones.

### Fase 2: Servicios
1. Crear `src/services/gameService.ts` con métodos para interactuar con la DB.

### Fase 3: UI
1. Modificar `src/pages/app.tsx` para incluir la pestaña "Game Room".
2. Desarrollar componentes `GameLobby` y `ActiveGame`.

### Fase 4: Testing
1. Probar flujo completo con dos usuarios diferentes.

## 6. Consideraciones "Safe Vibe"
- **No tocar**: Lógica de Auth, Trading o Portfolio existente.
- **Integración mínima**: Solo se añade una nueva pestaña y componentes aislados.
- **Seguridad**: Todas las transacciones de dinero se manejan server-side (RPC functions).