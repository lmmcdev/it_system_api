# Tests

Este directorio contiene los tests unitarios e integración para el proyecto Alert Events API.

## Estructura

```
tests/
├── middleware/          # Tests para middleware (autenticación, rate limiting)
├── utils/              # Tests para utilidades (validación, logging, error handling)
├── repositories/       # Tests para repositorios (CosmosDB, Azure Search)
└── services/           # Tests para servicios (lógica de negocio)
```

## Ejecutar Tests

### Todos los tests
```bash
npm test
```

### Tests en modo watch (desarrollo)
```bash
npm run test:watch
```

### Tests con cobertura
```bash
npm run test:coverage
```

### Tests verbose (más detalles)
```bash
npm run test:verbose
```

### Tests para CI/CD
```bash
npm run test:ci
```

## Escribir Tests

### Estructura de un test

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('NombreDelComponente', () => {
  beforeEach(() => {
    // Setup antes de cada test
  });

  afterEach(() => {
    // Cleanup después de cada test
  });

  describe('métodoEspecífico', () => {
    it('should do something expected', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = metodoBajoTest(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle edge cases', () => {
      expect(() => metodoBajoTest(null)).toThrow();
    });
  });
});
```

### Convenciones de nomenclatura

- **Archivos**: `*.test.ts` o `*.spec.ts`
- **Describe blocks**: Nombre del componente/clase/función
- **It blocks**: Descripción en inglés del comportamiento esperado
  - ✅ `it('should validate email format')`
  - ✅ `it('should throw error for invalid input')`
  - ❌ `it('test email')`

### Mocking

Para mockear dependencias externas:

```typescript
// Mock de Azure SDK
jest.mock('@azure/cosmos', () => ({
  CosmosClient: jest.fn()
}));

// Mock de funciones
const mockFunction = jest.fn().mockReturnValue('mocked value');
```

### Testing de funciones async

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Testing de errores

```typescript
it('should throw specific error', () => {
  expect(() => functionThatThrows()).toThrow(ValidationError);
  expect(() => functionThatThrows()).toThrow('Expected message');
});

it('should reject async errors', async () => {
  await expect(asyncFunctionThatRejects()).rejects.toThrow();
});
```

## Cobertura de Tests

### Ver reporte de cobertura

Después de ejecutar `npm run test:coverage`, abre:
```
coverage/lcov-report/index.html
```

### Objetivos de cobertura

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## Tests por Prioridad

### 1. Alta Prioridad (Crítico para seguridad)
- ✅ Validadores (validator.test.ts)
- ✅ Rate Limiting (rateLimit.test.ts)
- ✅ Error Handlers (errorHandler.test.ts)
- ⏳ Autenticación (authentication.test.ts)

### 2. Prioridad Media (Lógica de negocio)
- ⏳ Servicios (AlertEventService, SearchService)
- ⏳ Repositorios (mocked Azure SDKs)

### 3. Prioridad Baja (Integración)
- ⏳ Endpoints HTTP (requieren mocks complejos)
- ⏳ Tests end-to-end

## Buenas Prácticas

1. **Tests independientes**: Cada test debe poder ejecutarse solo
2. **Cleanup**: Usa `beforeEach`/`afterEach` para limpiar estado
3. **No hardcodear valores**: Usa constantes o factories
4. **Tests descriptivos**: El nombre debe explicar qué se testea
5. **Arrange-Act-Assert**: Estructura clara en cada test
6. **Un concepto por test**: No testear múltiples cosas en un solo `it`

## Debugging Tests

### Ejecutar un solo archivo
```bash
npm test -- validator.test.ts
```

### Ejecutar un solo test
```bash
npm test -- -t "should validate email format"
```

### Modo debug con breakpoints
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Luego abre Chrome DevTools: `chrome://inspect`

## CI/CD Integration

Los tests se ejecutan automáticamente en:
- Pre-commit hooks (opcional)
- Pull requests
- Merge a main branch

Configuración en `.github/workflows/test.yml` (cuando se configure).

## Recursos

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing TypeScript](https://jestjs.io/docs/getting-started#using-typescript)
- [Azure Functions Testing](https://docs.microsoft.com/azure/azure-functions/functions-test-a-function)
