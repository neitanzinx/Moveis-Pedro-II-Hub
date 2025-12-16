import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// 1. Importações do React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 2. Criação do cliente de query (Obrigatório)
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
    {/* 3. ENVOLVENDO O APP COM O PROVEDOR */}
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)