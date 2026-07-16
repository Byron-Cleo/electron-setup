import { LogOut, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { useAuthStore } from "@/stores/auth"

export function WaiterHeader() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <header className="flex items-center justify-between shrink-0 p-4 pb-0">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-brand-maroon flex items-center justify-center text-white">
          <Store size={20} />
        </div>
        <div>
          <span className="text-sm font-semibold text-brand-ebony">Eraeva</span>
          <p className="text-xs text-brand-ebony/60">Catering Services</p>
        </div>
        <div className="h-6 w-px bg-brand-ebony/20 mx-2" />
        <Heading as="h1" className="text-xl text-brand-maroon">Waiter POS</Heading>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-brand-maroon/10 flex items-center justify-center text-brand-maroon text-sm font-bold">
            {user?.name?.charAt(0)?.toUpperCase() || "W"}
          </div>
          <span className="text-sm font-medium text-brand-ebony">{user?.name || "Waiter"}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut size={18} />
        </Button>
      </div>
    </header>
  )
}