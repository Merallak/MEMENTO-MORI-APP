# 🗺️ Roadmap de Implementación: Memento Mori Protocol

Este documento define la ruta de implementación ordenada por eficiencia técnica y estabilidad del sistema.

## 🟢 Fase 1: Seguridad y Acceso (Completado ✅)
*Objetivo: Asegurar que los usuarios puedan mantener el acceso a sus cuentas antes de añadir complejidad.*

### 1.1. Recuperación de Contraseña 🔑
- **Estado:** ✅ Completado.
- **Funcionalidad:** Botón "¿Olvidaste tu contraseña?" en login y página dedicada `/update-password`.

---

## 🟡 Fase 2: Gestión del Ciclo de Vida del Token (Core Logic)
*Objetivo: Completar el CRUD (Create, Read, Update, Delete) de los tokens con reglas de negocio estrictas.*

### 2.1. Editar Detalles del Token ✏️
- **Tarea Técnica:**
  - Crear función `updateToken` en `dataService.ts`.
  - Agregar validación: Solo el `issuer_id` puede editar.
  - Actualizar la UI en la pestaña "Emitir Token" para permitir edición si ya existe un token.
- **Limitaciones:** No permitir editar `total_supply` o `ticker` (afecta trading), solo descriptivos (nombre, bio, imagen, precio actual/net worth).

### 2.2. Borrar Cuenta y Token (The "Exit Scam" Protection) 💀
- **Regla de Negocio:** Un usuario solo puede borrar su token si posee el **100% del suministro (Total Supply)**. Nadie más debe tener tokens.
- **Tarea Técnica:**
  - Crear función de verificación `checkTokenOwnership` (User Balance == Total Supply).
  - Si pasa la verificación -> Borrar órdenes abiertas -> Borrar Token -> Borrar Usuario.
  - Implementar "Zona de Peligro" en la UI con doble confirmación.
- **Riesgo:** Alto. Operación destructiva.

---

## 🔵 Fase 3: Economía Social (Pagos y Utilidad) 💸
*Objetivo: Habilitar el flujo de tokens entre usuarios fuera del mercado de trading.*

### 3.1. Solicitar Pago con QR 📱
- **Concepto:** "Cóbrale la cena a tu amigo en tus tokens".
- **Tarea Técnica:**
  - Generar QR con payload: `{ type: 'payment_request', tokenId: '...', amount: 10, recipient: 'user_id' }`.
  - UI de "Recibir" en la Billetera/Portfolio.

### 3.2. Escáner y Transferencia 📸
- **Tarea Técnica:**
  - Lector de QR (o input manual de código).
  - Pantalla de confirmación de transferencia P2P.
  - Ejecución de `transferToken` (función atómica en base de datos).

---

## 🟣 Fase 4: Onboarding y Asistencia (User Experience)
*Objetivo: Guiar a los usuarios una vez que las funcionalidades base son estables.*

### 4.1. Tutorial Interactivo (Walkthrough) 🎓
- **Estrategia:** Tour guiado sobre la UI final.

### 4.2. Chatbot de Soporte con IA 🤖
- **Funcionalidad:** Asistente que responde dudas sobre la app y reglas de negocio.

---

## ✅ Siguientes Pasos Inmediatos
1. Implementar `updateToken` en `dataService.ts`.
2. Modificar `IssueToken.tsx` para soportar "Modo Edición".