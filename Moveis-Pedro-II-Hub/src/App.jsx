import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { ConfirmProvider } from "@/hooks/useConfirm"

function App() {
  return (
    <ConfirmProvider>
      <Pages />
      <Toaster />
    </ConfirmProvider>
  )
}

export default App 