import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import {
  Wifi,
  Plug,
  Server,
  Receipt,
  UsersRound,
  ShieldAlert,
  MonitorDown,
  Terminal,
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

export default function NetworkTestGuide({ onBack }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">
        Final Network Test
      </Heading>
      <p className="text-sm text-admin-muted mb-6 text-center max-w-2xl mx-auto">
        Run through this once everything is installed and set up — it confirms the whole system works before the restaurant opens.
      </p>

      <div className="space-y-6">
        <SectionCard title="1. Check the server is ready" icon={Server}>
          <StepList
            steps={[
              "PostgreSQL is running (see the PostgreSQL Setup Guide).",
              "The backend is running in a terminal window: npm run dev:backend. It should show it connected and listening on port 3001.",
              "Find the server IP with ipconfig (e.g. 192.168.1.50).",
              "Port 3001 is allowed through the Windows firewall (Control Panel → Windows Defender Firewall → Advanced settings → Inbound rules → New rule → Port → TCP 3001 → Allow).",
            ]}
          />
        </SectionCard>

        <SectionCard title="2. Connect every terminal" icon={Plug}>
          <StepList
            steps={[
              "On each POS terminal, open Settings → Server Connection.",
              "The API endpoint should already show the server IP. If not, type it in.",
              "Click Test Connection — the badge must turn green (Connected).",
              "Click Save Server.",
            ]}
          />
        </SectionCard>

        <SectionCard title="3. Optional — check the web interface" icon={MonitorDown}>
          <StepList
            steps={[
              "On a phone connected to the same WiFi, open a browser and go to http://192.168.1.50:3001 (use your server IP).",
              "The login screen should load. You can log in from the phone too.",
            ]}
          />
        </SectionCard>

        <SectionCard title="4. Run a real order end-to-end" icon={Receipt}>
          <StepList
            steps={[
              "Log in on a terminal as a waiter (PIN 1111 in a fresh install).",
              "Open a table, add a few menu items, and send the order to the kitchen.",
              "On the kitchen screen the order should appear. Mark it as prepared.",
              "Complete the payment on the terminal — the customer receipt should print.",
            ]}
          />
        </SectionCard>

        <SectionCard title="5. Confirm every role can log in" icon={UsersRound}>
          <StepList
            steps={[
              "Log in as each role and confirm each lands in the right screen: Waiter (order pad), Store (stock), Kitchen (order queue), Manager (dashboard), Admin (everything).",
              "Check the order you placed shows up under Admin → Cashier / reports.",
            ]}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <Wifi size={20} className="text-green-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">How it all works</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <Server size={16} className="mt-0.5 shrink-0 text-green-600" />
              One server computer runs the database and backend; terminals and phones all talk to it over the network.
            </li>
            <li className="flex gap-2">
              <Wifi size={16} className="mt-0.5 shrink-0 text-green-600" />
              If every terminal shows a green connection and one order flows through to the kitchen and printer, the system is live.
            </li>
            <li className="flex gap-2">
              <Terminal size={16} className="mt-0.5 shrink-0 text-green-600" />
              Keep the backend terminal window open while the restaurant is open — closing it stops the whole system.
            </li>
          </ul>
        </Card>

        <Card className="p-6 space-y-3 border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} className="text-amber-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">Checklist — if something fails</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <Plug size={16} className="mt-0.5 shrink-0 text-green-600" />
              Terminal can't connect → is the backend running, is port 3001 open in the firewall, and is the IP exact?
            </li>
            <li className="flex gap-2">
              <Receipt size={16} className="mt-0.5 shrink-0 text-green-600" />
              No receipt prints → check the printer drivers guide, and the printer role in POS Printer Config.
            </li>
            <li className="flex gap-2">
              <UsersRound size={16} className="mt-0.5 shrink-0 text-green-600" />
              A role can't log in → check the PIN is 4 digits and the account is Active in Admin → Users.
            </li>
            <li className="flex gap-2">
              <Wifi size={16} className="mt-0.5 shrink-0 text-green-600" />
              Phones can't load the web interface → they must be on the same WiFi as the server.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
