# DevAtlas

> **Estado: Activo** — en uso para el trabajo del día a día.

Catálogo/atlas personal de aplicaciones de desarrollo. Registrás cada app con su
descripción, stack, ruta del repo, notas (Markdown), URLs por ambiente y tags, y
después la buscás o filtrás desde una lista.

## Stack

- **Backend:** .NET 10 (ASP.NET Core Web API) + EF Core con SQLite y migraciones.
- **Auth:** login con Google y JWT propio; cada usuario ve solo sus datos.
- **Frontend:** React + TypeScript + Vite, con React Router y `react-markdown`.
- **Tests:** integración de la API con xUnit y componentes del front con Vitest.

## Estructura

```
DevAtlas/
├─ backend/DevAtlas.Api/     # API .NET (controllers, EF Core, migraciones)
│  ├─ Controllers/           # ApplicationsController
│  ├─ Data/                  # DevAtlasContext
│  ├─ Dtos/                  # DTOs de request/response (con validación)
│  ├─ Models/                # Application, ApplicationUrl, Tag, ApplicationTag
│  └─ Migrations/
└─ frontend/                 # SPA React + Vite
   └─ src/
      ├─ api/client.ts       # cliente HTTP de la API
      ├─ pages/              # ApplicationList / ApplicationDetail / ApplicationForm
      └─ types/              # tipos compartidos
```

## Cómo levantarlo

Requiere .NET SDK 10 y Node.js.

**Configuración** (una sola vez). La API guarda sus secretos con user-secrets, fuera del repo:

```bash
dotnet user-secrets set "Jwt:Key" "<clave de al menos 32 bytes>" --project backend/DevAtlas.Api
dotnet user-secrets set "Google:ClientId" "<client id de OAuth de Google>" --project backend/DevAtlas.Api
```

`Jwt:Key` es obligatoria: sin ella la API no arranca. El front necesita el mismo client id en
`frontend/.env` (copiá `frontend/.env.example`) como `VITE_GOOGLE_CLIENT_ID`.

**Backend** (puerto 5142):

```bash
cd backend/DevAtlas.Api
dotnet run
```

Aplica las migraciones automáticamente al iniciar y crea `devatlas.db` (SQLite) si no existe.

**Frontend** (puerto 5173):

```bash
cd frontend
npm install
npm run dev
```

Por defecto el frontend pega a `http://localhost:5142/api`. Para apuntar a otra URL,
ajustá `VITE_API_URL` en `frontend/.env`.

**Tests:**

```bash
dotnet test backend/DevAtlas.Api.Tests
cd frontend && npm test
```

## Modelo de datos

- **Application** — nombre, descripción, repo, stack, notas, responsable (owner),
  estado (active/paused/deprecated), favorito, archivada, timestamps.
- **Client** — cliente/proyecto que agrupa aplicaciones (ej. Acme → portal-web,
  api-pedidos...). Nombre único; se resuelve por nombre al guardar (get-or-create). 1-N con Application.
- **AppEnvironment** — catálogo reutilizable de ambientes (Dev, Test, QA, Prod, UAT...) con
  nombre único, orden y color. Sembrado con Dev/Test/QA/Prod.
- **ApplicationUrl** — URL de una app asociada a un ambiente del catálogo (FK), 1-N con Application.
  Al guardar, el ambiente se resuelve por nombre (get-or-create).
- **DatabaseConnection** — conexión a BD de una app, por ambiente (motor, host, puerto, base,
  usuario). La password se guarda **cifrada** (ASP.NET Data Protection; la clave vive en el key
  ring del sistema, fuera del `.db` y del repo) o no se guarda (solo `SecretRef` al vault). Nunca
  se expone en las respuestas: sólo el endpoint `/reveal` la descifra bajo pedido.
- **Tag** / **ApplicationTag** — tags con relación N-N; los nombres son únicos y se
  normalizan (trim + case-insensitive) al guardar.

## API

Base: `/api`

| Método | Ruta                       | Descripción                                       |
|--------|----------------------------|---------------------------------------------------|
| GET    | `/applications`            | Lista; filtros `?search=`, `?tag=`, `?sort=`, `?clientId=`, `?includeArchived=` |
| GET    | `/applications/{id}`       | Detalle                                           |
| POST   | `/applications`            | Crear                                             |
| PUT    | `/applications/{id}`       | Actualizar                                        |
| DELETE | `/applications/{id}`       | Eliminar                                          |
| PATCH  | `/applications/{id}/favorite` | Marcar/desmarcar favorito (body: `true`/`false`) |
| PATCH  | `/applications/{id}/archive`  | Archivar/desarchivar (body: `true`/`false`)   |
| GET    | `/applications/stats`      | Resumen (totales, por stack, tags top)            |
| GET    | `/applications/tags`       | Lista de tags existentes                          |
| GET    | `/clients`                 | Lista de clientes con conteo de apps              |
| PUT    | `/clients/{id}`            | Editar cliente (nombre, color)                    |
| POST   | `/applications/{id}/databases`         | Crear conexión a BD                   |
| PUT    | `/applications/{id}/databases/{dbId}`  | Editar conexión                       |
| DELETE | `/applications/{id}/databases/{dbId}`  | Eliminar conexión                     |
| GET    | `/applications/{id}/databases/{dbId}/reveal` | Revelar la password (descifra) |
| GET    | `/environments`            | Catálogo de ambientes                             |
| POST   | `/environments`            | Crear ambiente                                    |
| PUT    | `/environments/{id}`       | Editar ambiente                                   |
| DELETE | `/environments/{id}`       | Eliminar (solo si no está en uso)                 |

## Autenticación y datos por usuario

El login es con Google: el front obtiene el ID token, la API lo valida contra `Google:ClientId`
y emite un JWT propio firmado con `Jwt:Key`. Cada usuario ve y edita solo sus propias
aplicaciones, clientes, tags y ambientes. Las passwords de las bases se guardan cifradas con ASP.NET Data
Protection y solo se descifran bajo pedido.
