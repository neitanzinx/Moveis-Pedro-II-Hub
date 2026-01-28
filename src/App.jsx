import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { ConfirmProvider } from "@/hooks/useConfirm"
import { AuthProvider } from "@/hooks/useAuth"

function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Pages />
        <Toaster />
      </ConfirmProvider>
    </AuthProvider>
  )
}

export default App 