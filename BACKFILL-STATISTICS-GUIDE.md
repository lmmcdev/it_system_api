# Guía de Backfill de Estadísticas

**Última Actualización**: 2025-10-21
**Funcionalidad**: ✅ Implementada

## 📋 Resumen

El endpoint `/trigger/generate-statistics` ahora acepta un parámetro opcional `date` para generar estadísticas de cualquier día específico, no solo del día actual.

## 🎯 Funcionalidad Nueva

### Parámetro `date`
- **Formato**: `YYYY-MM-DD` (ejemplo: `2025-10-15`)
- **Opcional**: Si no se proporciona, usa el día actual (comportamiento anterior)
- **Validaciones**:
  - ✅ Formato debe ser exactamente `YYYY-MM-DD`
  - ✅ Fecha debe ser válida (no acepta 30 de febrero, etc.)
  - ✅ No acepta fechas futuras
  - ✅ Rango de años: 1900-2100

## 📝 Ejemplos de Uso

### 1. Generar Estadísticas del Día Actual (Por Defecto)
```bash
GET /api/trigger/generate-statistics?code=tu-key

# Respuesta:
{
  "message": "Statistics generation completed successfully",
  "targetDate": "2025-10-21",  # Día actual
  "period": {
    "startDate": "2025-10-21T00:00:00.000Z",
    "endDate": "2025-10-21T23:59:59.999Z"
  },
  "typesGenerated": 4,
  "totalAlertsProcessed": 150,
  "results": [
    { "type": "detectionSource", "id": "detectionSource_2025-10-21", ... }
  ]
}
```

### 2. Generar Estadísticas de un Día Específico
```bash
GET /api/trigger/generate-statistics?date=2025-10-15&code=tu-key

# Respuesta:
{
  "message": "Statistics generation completed successfully",
  "targetDate": "2025-10-15",  # Día solicitado
  "period": {
    "startDate": "2025-10-15T00:00:00.000Z",
    "endDate": "2025-10-15T23:59:59.999Z"
  },
  "typesGenerated": 4,
  "totalAlertsProcessed": 89,
  "results": [
    { "type": "detectionSource", "id": "detectionSource_2025-10-15", ... },
    { "type": "userImpact", "id": "userImpact_2025-10-15", ... },
    { "type": "ipThreats", "id": "ipThreats_2025-10-15", ... },
    { "type": "attackTypes", "id": "attackTypes_2025-10-15", ... }
  ]
}
```

### 3. Generar Estadísticas con Fecha Inválida
```bash
GET /api/trigger/generate-statistics?date=2025-02-30&code=tu-key

# Respuesta (400 Bad Request):
{
  "error": "Validation Error",
  "message": "Invalid date: 2025-02-30. Must be a valid date in YYYY-MM-DD format."
}
```

### 4. Generar Estadísticas con Fecha Futura
```bash
GET /api/trigger/generate-statistics?date=2025-12-31&code=tu-key

# Respuesta (400 Bad Request):
{
  "error": "Validation Error",
  "message": "Invalid date: 2025-12-31. Date cannot be in the future."
}
```

## 🔄 Backfill de Múltiples Días

Para generar estadísticas de varios días (backfill histórico), necesitas llamar al endpoint múltiples veces:

### Ejemplo: Backfill de Octubre 1-10, 2025

**Opción 1: Llamadas Manuales**
```bash
curl "http://localhost:7071/api/trigger/generate-statistics?date=2025-10-01&code=key"
curl "http://localhost:7071/api/trigger/generate-statistics?date=2025-10-02&code=key"
curl "http://localhost:7071/api/trigger/generate-statistics?date=2025-10-03&code=key"
# ... continuar hasta 2025-10-10
```

**Opción 2: Script Bash**
```bash
#!/bin/bash
API_KEY="tu-clave-de-funcion"
BASE_URL="http://localhost:7071/api"

for day in {01..10}; do
  date="2025-10-${day}"
  echo "Generating statistics for $date..."
  curl -s "${BASE_URL}/trigger/generate-statistics?date=${date}&code=${API_KEY}" | jq .
  sleep 2  # Pausa de 2 segundos entre llamadas
done
```

**Opción 3: Script PowerShell**
```powershell
$apiKey = "tu-clave-de-funcion"
$baseUrl = "http://localhost:7071/api"

1..10 | ForEach-Object {
    $day = $_.ToString("00")
    $date = "2025-10-$day"
    Write-Host "Generating statistics for $date..."

    $url = "$baseUrl/trigger/generate-statistics?date=$date&code=$apiKey"
    $response = Invoke-RestMethod -Uri $url -Method Get
    $response | ConvertTo-Json

    Start-Sleep -Seconds 2
}
```

**Opción 4: Script Node.js**
```javascript
const axios = require('axios');

const API_KEY = 'tu-clave-de-funcion';
const BASE_URL = 'http://localhost:7071/api';

async function backfillStatistics(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().substring(0, 10);

    console.log(`Generating statistics for ${dateStr}...`);

    try {
      const response = await axios.get(
        `${BASE_URL}/trigger/generate-statistics`,
        {
          params: { date: dateStr, code: API_KEY }
        }
      );

      console.log(`✅ Success: ${response.data.totalAlertsProcessed} alerts processed`);
    } catch (error) {
      console.error(`❌ Failed: ${error.response?.data?.message || error.message}`);
    }

    // Pausa de 2 segundos entre llamadas
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Ejecutar: backfill de Oct 1-10, 2025
backfillStatistics('2025-10-01', '2025-10-10');
```

## 📊 IDs de Documentos Generados

Cada fecha genera 4 documentos con IDs predecibles:

```
Para la fecha 2025-10-15:
- detectionSource_2025-10-15
- userImpact_2025-10-15
- ipThreats_2025-10-15
- attackTypes_2025-10-15
```

## 🔒 Validaciones de Seguridad

### 1. Formato de Fecha
```bash
# ✅ Válido
date=2025-10-15

# ❌ Inválido
date=2025/10/15        # Formato incorrecto (debe usar guiones)
date=15-10-2025        # Orden incorrecto (debe ser YYYY-MM-DD)
date=2025-10-15T10:00  # No debe incluir hora
```

### 2. Fechas Válidas
```bash
# ✅ Válido
date=2024-02-29  # 2024 es año bisiesto

# ❌ Inválido
date=2025-02-29  # 2025 NO es año bisiesto
date=2025-04-31  # Abril solo tiene 30 días
date=2025-13-01  # Mes inválido (13)
date=2025-00-15  # Mes inválido (00)
```

### 3. Rango de Fechas
```bash
# ✅ Válido
date=2020-01-01  # Fecha pasada
date=2025-10-21  # Fecha actual

# ❌ Inválido
date=2025-12-31  # Fecha futura (si hoy es 21 de octubre)
date=1899-01-01  # Antes de 1900
date=2101-01-01  # Después de 2100
```

## ⚙️ Timer Automático

El timer automático (`generateAlertStatisticsTimer`) **NO cambió**:
- Continúa ejecutándose cada hora (`0 0 * * * *`)
- Genera estadísticas del **día actual** automáticamente
- No acepta parámetros (diseñado para operación automática)

**Uso del Timer**:
- Operación diaria normal: Timer automático
- Backfill histórico: Endpoint HTTP con parámetro `date`

## 🎯 Casos de Uso

### 1. Generación Diaria Normal
El timer se encarga automáticamente, **no se requiere acción manual**.

### 2. Backfill Histórico
Cuando necesitas generar estadísticas de días pasados:
```bash
# Ejemplo: Generar estadísticas del 15 de octubre
GET /api/trigger/generate-statistics?date=2025-10-15&code=key
```

### 3. Regenerar Estadísticas
Si los datos se corrigieron y necesitas actualizar las estadísticas:
```bash
# Las estadísticas se sobrescriben (UPSERT) con los datos actualizados
GET /api/trigger/generate-statistics?date=2025-10-15&code=key
```

### 4. Verificar Generación
Después de generar, verifica con:
```bash
GET /api/statistics?type=detectionSource&startDate=2025-10-15&endDate=2025-10-15&code=key

# Debe retornar exactamente UN documento con ID: detectionSource_2025-10-15
```

## 📝 Logs y Monitoreo

Los logs incluyen información de la fecha objetivo:

```json
{
  "level": "INFO",
  "message": "[Statistics Generation] Processing period determined",
  "context": {
    "isInitialRun": false,
    "period": {
      "startDate": "2025-10-15T00:00:00.000Z",
      "endDate": "2025-10-15T23:59:59.999Z",
      "periodType": "daily"
    },
    "targetDate": "2025-10-15"
  }
}
```

## ⚡ Performance

- **Tiempo de Ejecución**: 8-12 segundos (igual que antes)
- **RU Consumption**: 50-70 RU (igual que antes)
- **Rate Limiting**: Considera pausas de 2-5 segundos entre llamadas para backfill

## 🔄 Compatibilidad

### ✅ 100% Retrocompatible

**Comportamiento Anterior** (sin parámetro `date`):
```bash
GET /trigger/generate-statistics?code=key
# Genera estadísticas del día actual
```

**Comportamiento Nuevo** (con parámetro `date`):
```bash
GET /trigger/generate-statistics?date=2025-10-15&code=key
# Genera estadísticas del 15 de octubre
```

**Sin Cambios**:
- Timer automático
- Formato de respuesta
- IDs de documentos
- Estructura de datos
- Otros endpoints

## 🚨 Errores Comunes

### Error: Formato de Fecha Inválido
```json
{
  "error": "Validation Error",
  "message": "Invalid date format: 2025/10/15. Must be YYYY-MM-DD."
}
```
**Solución**: Usar formato `YYYY-MM-DD` con guiones.

### Error: Fecha Futura
```json
{
  "error": "Validation Error",
  "message": "Invalid date: 2025-12-31. Date cannot be in the future."
}
```
**Solución**: Solo usar fechas pasadas o del día actual.

### Error: Fecha Inválida
```json
{
  "error": "Validation Error",
  "message": "Invalid date: 2025-02-30. Must be a valid date."
}
```
**Solución**: Verificar que la fecha exista (febrero no tiene 30 días).

### Error: No Hay Alertas
```json
{
  "message": "Statistics generation completed successfully",
  "totalAlertsProcessed": 0
}
```
**Solución**: Normal si no hay alertas para esa fecha. Las estadísticas se generan vacías.

## 📚 Referencias

- **API Endpoints**: `API-ENDPOINTS-SUMMARY.md`
- **UPSERT Pattern**: `STATISTICS-DAILY-UPSERT.md`
- **Implementación**: `IMPLEMENTATION-SUMMARY.md`
- **Swagger UI**: `http://localhost:7071/api/swagger`

---

**Implementado**: 2025-10-21
**Estado**: ✅ Producción Ready
**Versión**: 2.0 (con soporte de parámetro `date`)
