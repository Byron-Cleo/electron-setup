import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import {
  Luggage,
  MonitorDown,
  PackageCheck,
  Wifi,
  Download,
  Printer,
  Server,
  ListChecks,
  ShieldAlert,
  CheckCircle2,
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

export default function PreDeploymentGuide({ onBack }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">
        Pre-Deployment Checklist (Before You Travel)
      </Heading>
      <p className="text-sm text-admin-muted mb-6 text-center max-w-2xl mx-auto">
        Do this at home, before you go to the restaurant. Everything here can be tested in advance so the setup day goes smoothly.
      </p>

      <div className="space-y-6">
        <SectionCard title="1. Build and test the Windows installer" icon={PackageCheck}>
          <StepList
            steps={[
              "Find a Windows computer and run the build (see Build the Windows Installer guide).",
              "Install the resulting .exe on a test Windows machine.",
              "Open the app and confirm it starts and shows the login screen.",
              "This is the step most likely to surprise you — test it at home, not at the restaurant.",
            ]}
          />
        </SectionCard>

        <SectionCard title="2. Test printers on Windows" icon={Printer}>
          <StepList
            steps={[
              "Install the receipt printer drivers on the test Windows machine (see Install Printer Drivers guide).",
              "Add the printer in the app and print a test receipt.",
              "Verify USB detection and the Customer / Kitchen / Bar roles work.",
            ]}
          />
        </SectionCard>

        <SectionCard title="3. Run one order end-to-end" icon={MonitorDown}>
          <StepList
            steps={[
              "Install the backend, database and app on the test server (the whole setup flow).",
              "Log in as waiter, place an order, see it in the kitchen, pay, and print the receipt.",
              "This dry run catches most issues before you arrive.",
            ]}
          />
        </SectionCard>

        <SectionCard title="4. Download everything in advance" icon={Download}>
          <StepList
            steps={[
              "If the restaurant has no internet, download at home: Node.js LTS installer, PostgreSQL Windows installer, and all printer drivers.",
              "Save them on a USB drive alongside the project folder.",
              "Copy the installer .exe you built in step 1 to the same USB drive.",
            ]}
          />
        </SectionCard>

        <SectionCard title="5. Gather the hardware" icon={Luggage}>
          <StepList
            steps={[
              "Server computer (the one that will always stay on).",
              "POS terminals for the counter and dining areas.",
              "Receipt printers (customer, kitchen, bar).",
              "A USB drive with the project, installers and drivers.",
              "The WiFi password for the restaurant network.",
            ]}
          />
        </SectionCard>

        <SectionCard title="6. Prepare the restaurant data" icon={ListChecks}>
          <StepList
            steps={[
              "Write down the menu: every dish, its price, category and meal period.",
              "List the stock supplies and their units (L, KG, PKT, ML, PCS).",
              "List the departments (Kitchen, Bar, Pastry, etc.).",
              "List the staff and the role + 4-digit PIN each one will use.",
              "Have this list ready when you run Enter Restaurant Data at the restaurant.",
            ]}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <Server size={20} className="text-green-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">Why it matters</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <PackageCheck size={16} className="mt-0.5 shrink-0 text-green-600" />
              The Windows installer has never been built before — build it at home so a missing piece doesn't stop the setup day.
            </li>
            <li className="flex gap-2">
              <Wifi size={16} className="mt-0.5 shrink-0 text-green-600" />
              First-time downloads (Node.js, PostgreSQL, npm packages, Electron) all need internet. Carry them on a USB drive.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              A dry run at home means the restaurant visit is mostly data entry and connecting terminals.
            </li>
          </ul>
        </Card>

        <Card className="p-6 space-y-3 border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} className="text-amber-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">Ready to travel when…</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              The Windows installer exists and installed cleanly on a test machine.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              A printer printed a test receipt from the app on Windows.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              One order ran end-to-end (order → kitchen → receipt).
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              The USB drive has the project, installers, drivers and the .exe.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              The menu, stock, staff and PIN list are written down.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
