import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
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
      <Heading as="h1" className="mb-6 text-admin-header-text">Settings</Heading>
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
                <Heading as="h3" className="text-admin-header-text">{card.title}</Heading>
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
