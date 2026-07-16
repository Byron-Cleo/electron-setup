import { Truck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"

function Menu() {
  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-admin-header-text">Menu</Heading>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          className="p-6 cursor-pointer hover:border-admin-accent transition-colors"
          onClick={() => {}}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Truck size={24} className="text-green-600" />
            </div>
            <div>
              <Heading as="h3" className="text-lg text-admin-header-text">Food in Dispatch</Heading>
              <p className="text-sm text-admin-muted">Food in dispatch to be ordered by waiters</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default Menu
