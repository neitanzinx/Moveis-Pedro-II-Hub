import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// 1. Importações do React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 2. Importação do TenantProvider (Multi-Tenant)
import { TenantProvider } from '@/contexts/TenantContext'

// 3. Criação do cliente de query (Obrigatório)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Configurações para evitar recargas excessivas, melhorando a performance
      staleTime: 1000 * 60 * 5, // Dados "frescos" por 5 minutos
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 4. ENVOLVENDO O APP COM OS PROVEDORES */}
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <App />
      </TenantProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)