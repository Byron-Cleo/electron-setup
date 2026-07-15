import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Package, Tag } from "lucide-react"

const cards = [
  {
    title: "Stock Supply Categories",
    description: "Manage types of raw materials",
    icon: Package,
    path: "/admin/manager/stock-supply-categories",
  },
  {
    title: "Stock Supplies",
    description: "Manage raw materials",
    icon: Tag,
    path: "/admin/manager/stock-supplies",
  },
]

function Manager() {
  const navigate = useNavigate()

  return (
    <div>
      <h1 className="text-2xl font-bold text-admin-header-text mb-6">Manager</h1>
      <div className="flex gap-6">
        {cards.map((card) => (
          <Card
            key={card.path}
            className="w-[300px] bg-admin-card border-admin-card-border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(card.path)}
          >
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="h-14 w-14 rounded-full bg-admin-accent/10 flex items-center justify-center">
                <card.icon className="h-7 w-7 text-admin-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-admin-header-text">{card.title}</h3>
                <p className="text-sm text-admin-header-text/60 mt-1">{card.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default Manager
