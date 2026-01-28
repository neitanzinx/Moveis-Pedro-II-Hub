---
description: # Moveis Pedro II - AI Agent Instructions
---

## Project Overview
**Moveis Pedro II** is a comprehensive ERP system for furniture sales and logistics, built with React+Vite frontend connected to Supabase backend via the Base44 SDK. It supports multi-tenant data architecture, role-based access control, and a dual authentication system for customers and employees. The objective is build a scalable, maintainable codebase that enables efficient management of sales, inventory, deliveries, and financials. This ERP system also integrates with external services like invoincing APIs and a WhatsApp bot for customer notifications. We want to ensure a smooth developer experience with clear patterns for adding new features and maintaining data integrity. Future enhancements may include invoicement generation, advanced reporting, and expanded logistics capabilities.

### Core Tech Stack
- **Frontend**: React 18 + Vite + TailwindCSS + shadcn/ui
- **Backend**: Supabase PostgreSQL + Base44 SDK
- **Data Layer**: React Query (TanStack) for state management
- **Auth**: Dual-auth system (Supabase for clients, JWT-based for employees)

## Critical Architecture Patterns

### 1. Multi-Tenant Data Architecture
- Tenant context (`TenantContext.jsx`) manages organization-level data, settings, and store configurations
- Default organization ID: `00000000-0000-0000-0000-000000000001`
- All queries must respect tenant isolation; check `scope` rules in `ROLE_RULES` (ALL, STORE, or OWN)
- **File**: [src/contexts/TenantContext.jsx](src/contexts/TenantContext.jsx)

### 2. Entity-Based API Layer
- Base44 SDK maps entities to Supabase tables via `tableMap` in [src/lib/supabase.js](src/lib/supabase.js)
- Usage: `base44.entities.EntityName.list()`, `.create()`, `.update()`, `.delete()`
- Example: `base44.entities.Venda.list('-data_venda')` sorts by date descending
- **Always** import from `@/lib/supabase` (not deprecated `base44Client.js`)

### 3. React Query (TanStack) Pattern
- Centralized query management with 5-minute staleTime by default
- Mutation example: `useMutation` with `onSuccess` invalidating related query keys
- Common query keys: `['vendas']`, `['clientes']`, `['entregas']`, `['montagens']`, `['lancamentos-financeiros']`
- **File**: [src/pages/Vendas.jsx](src/pages/Vendas.jsx) demonstrates the complete pattern

### 4. Role-Based Access Control (RBAC)
- Roles defined in [src/config/permissions.js](src/config/permissions.js): Administrador, Gerente, Gerente Geral, Vendedor, etc.
- Each role has `can` (permissions array) and `scope` (data visibility: ALL/STORE/OWN)
- Use `useAuth()` hook to get `user`, `filterData()`, and `can()` for permission checks
- **Pattern**: `if (can('manage_vendas')) { /* show edit button */ }`

### 5. Dual Authentication System
- **Supabase Auth**: Customer/public users via email, persists in localStorage
- **Employee JWT**: Internal staff authentication via token stored in `employee_token` localStorage key
- Hook decides auth type automatically in [src/hooks/useAuth.jsx](src/hooks/useAuth.jsx)
- Token auto-refresh if expiring within 5 minutes

## Component & File Structure

### Page Organization
- Pages in [src/pages/](src/pages/) are route handlers: Vendas.jsx, Clientes.jsx, Estoque.jsx, etc.
- Supporting components in nested folders: [src/components/vendas/](src/components/vendas/), [src/components/clientes/](src/components/clientes/), etc.

### UI Components
- All UI from shadcn/ui (Button, Input, Table, Tabs, Badge, etc.)
- TailwindCSS classes with CSS variables (primary: #07593f, secondary: #f38a4c from TenantContext)
- Custom hooks: `useConfirm()` for confirmation dialogs, `useAuth()` for user state
- Do not use emojis.

### Supporting Infrastructure
- **API**: [src/api/](src/api/) - Base44 client setup and entity functions
- **Config**: [src/config/](src/config/) - cargos.js, empresa.js, permissions.js (reference tables)
- **Hooks**: [src/hooks/](src/hooks/) - useAuth.jsx, useConfirm.jsx, useEmployeeAuth.jsx, etc.
- **Utils**: [src/lib/utils.js](src/lib/utils.js) - helper functions; [src/lib/supabase.js](src/lib/supabase.js) - core auth & tableMap

## Development Workflow

### Commands
```bash
npm run dev              # Frontend (Vite on :5173)
npm run dev:bot         # WhatsApp bot server (:3001)
npm run dev:all         # Both concurrently
npm run build           # Production build
npm run lint            # ESLint check
npm run test            # Vitest runner
npm run test:watch      # Watch mode
```

### Key Integration Points
- **NuvemFiscal API** (NFe emission): Proxied via Vite [vite.config.js](vite.config.js)
- **WhatsApp Bot**: Separate Node.js service in [robo whatsapp agendamentos/](robo%20whatsapp%20agendamentos/) (can run in Docker)
- **Supabase RLS**: Enable via SQL migrations in [sql/](sql/) directory

### Debugging Tips
- Token refresh logged to console as "✅ Token renovado"
- React Query DevTools helpful for query state inspection
- Check localStorage for `moveis-pedro-ii-auth-token` (Supabase) or `employee_token` (JWT)

## Common Implementation Patterns

### Adding a New CRUD Page
1. Create page component in [src/pages/YourEntity.jsx](src/pages/)
2. Define `useQuery` for list and `useMutation` for create/update/delete with `base44.entities.YourEntity`
3. Add permission checks: `can('view_yourmodule')` and `filterData(data, 'store')` for multi-tenant filtering
4. Invalidate queries on mutation success: `queryClient.invalidateQueries(['yourentity'])`

### Adding Permissions for New Features
1. Add permission string to relevant role's `can` array in [src/config/permissions.js](src/config/permissions.js)
2. Add UI control: `{can('new_permission') && <Button>Action</Button>}`

### Data Filtering by Tenant/Scope
- Use `filterData(entity_array, scope)` from `useAuth()` to filter array
- Or use RLS policies in database (see [sql/migration_rls_policies.sql](sql/migration_rls_policies.sql))

## Database & Migrations
- Schema defined in [schema.sql](schema.sql) and [migration_script.sql](migration_script.sql)
- Specialized migrations in [sql/](sql/): multi-tenant, RLS, NFe, HR, logistics, etc.
- Table map in [src/lib/supabase.js](src/lib/supabase.js) lists all ~50+ entities

## Notes for AI Agents
- **Backward compatibility**: `api/base44Client.js` is deprecated; always use `@/lib/supabase` imports
- **Type safety**: Project uses JSX (not TypeScript); keep prop validation simple or use JSDoc comments
- **Performance**: Refetch intervals set to 10s for real-time features (deliveries, assemblies)
- **Concurrency**: npm script `dev:all` runs frontend + bot; be aware of both processes when testing
- **Environment vars**: Use `import.meta.env.VITE_*` for frontend; `.env` file for backend services
