import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import {
  UtensilsCrossed,
  Warehouse,
  Building2,
  ChefHat,
  UsersRound,
  ListChecks,
  CheckCircle2,
  ShieldAlert,
  Server,
} from "lucide-react"

interface Props {
  onBack: () => void
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm text-admin-muted leading-relaxed">
          <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500/15 text-xs font-semibold text-green-600">
            {i + 1}
          </span>
          <span className="min-w-0">{step}</span>
        </li>
      ))}
    </ol>
  )
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Server
  children: ReactNode
}) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
          <Icon size={20} className="text-green-600" />
        </div>
        <Heading as="h3" className="text-lg text-admin-header-text">{title}</Heading>
      </div>
      {children}
    </Card>
  )
}

export default function DataEntryGuide({ onBack }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">
        Enter Restaurant Data
      </Heading>
      <p className="text-sm text-admin-muted mb-6 text-center max-w-2xl mx-auto">
        On a brand-new database there is nothing in the system yet. Enter your menu, stock and staff once, and it is available on every terminal. Do this in the order below.
      </p>

      <div className="space-y-6">
        <SectionCard title="1. Add the menu items" icon={UtensilsCrossed}>
          <StepList
            steps={[
              "Log in as admin and open Admin → Menu.",
              "Click to add a new item and fill in: name, category (Beef, Chicken, Drinks, etc.), price (KSh), and the meal periods the dish is available in (Breakfast / Lunch / Dinner / Dessert / Beverage).",
              "Optionally attach a starch and vegetable accompaniment.",
              "Add every dish you serve. This is the menu waiters use to place orders.",
            ]}
          />
        </SectionCard>

        <SectionCard title="2. Add the departments" icon={Building2}>
          <StepList
            steps={[
              "Open Settings → Restaurant Departments.",
              "Add the departments that can request stock (e.g. Kitchen, Bar, Pastry).",
            ]}
          />
        </SectionCard>

        <SectionCard title="3. Add stock supplies" icon={Warehouse}>
          <StepList
            steps={[
              "Open Admin → Store/Procurement → Stock Supplies → Add New Supply.",
              "Fill in the name and stock unit (L, KG, PKT, ML or PCS), the current count, and a reorder level (the app warns when stock drops to this number).",
              "Tick Is Menu Item? if this stock converts into plates, then link the menu items it is used for.",
              "Assign the departments that can request it.",
              "Add all your supplies — this is what store keepers use to track and request stock.",
            ]}
          />
        </SectionCard>

        <SectionCard title="4. Configure kitchen conversions" icon={ChefHat}>
          <StepList
            steps={[
              "Open Settings → Kitchen Stock Configuration.",
              "Set how each stock item converts to menu plates (how many plates one unit of stock produces).",
            ]}
          />
        </SectionCard>

        <SectionCard title="5. Add staff accounts" icon={UsersRound}>
          <StepList
            steps={[
              "Open Admin → Users.",
              "Click to add each staff member: name, email, a 4-digit PIN they will use to log in, and their role (Admin, Manager, Waiter, Store, Kitchen).",
              "Give everyone their own PIN. You can reset a PIN here any time.",
            ]}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <ListChecks size={20} className="text-green-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">Order matters</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <UtensilsCrossed size={16} className="mt-0.5 shrink-0 text-green-600" />
              Enter menu items first — stock supplies link to menu items, so the menu must exist first.
            </li>
            <li className="flex gap-2">
              <Warehouse size={16} className="mt-0.5 shrink-0 text-green-600" />
              Departments before stock, so you can assign who may request each supply.
            </li>
            <li className="flex gap-2">
              <UsersRound size={16} className="mt-0.5 shrink-0 text-green-600" />
              Staff last — once data is in, create accounts for everyone to use the system.
            </li>
          </ul>
        </Card>

        <Card className="p-6 space-y-3 border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} className="text-amber-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">Checklist — before opening</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              Every dish has a price, category and at least one meal period.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              Stock supplies have a unit and reorder level.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              Kitchen conversions set for the menu plates.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              Every staff member has a working PIN — test log in as a waiter, store and kitchen user.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
