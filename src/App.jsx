import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { ConfirmProvider } from "@/hooks/useConfirm"
import { AuthProvider } from "@/hooks/useAuth"

function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Pages />
        <Toaster />
        <SonnerToaster />
      </ConfirmProvider>
    </AuthProvider>
  )
}

export default App 