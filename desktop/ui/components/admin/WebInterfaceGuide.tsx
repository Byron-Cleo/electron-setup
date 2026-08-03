import { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import {
  PackageSearch,
  Database,
  Terminal,
  Globe,
  MonitorSmartphone,
  ShieldAlert,
  Plug,
  Lock,
} from "lucide-react"

interface Props {
  onBack: () => void
}

function CodeBlock({ children }: { children: string }) {
  return (
    <code className="block w-full rounded-md bg-muted px-3 py-2.5 text-xs font-mono text-admin-header-text break-all">
      {children}
    </code>
  )
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
  icon: typeof Globe
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

export default function WebInterfaceGuide({ onBack }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">
        Web Interface Setup (WiFi)
      </Heading>
      <p className="text-sm text-admin-muted mb-6 text-center max-w-2xl mx-auto">
        Turn the server computer into a web server so any phone, tablet or laptop
        on the network can open the app in a browser. Follow the sections{" "}
        <span className="font-semibold text-admin-header-text">in order</span>.
      </p>

      <div className="space-y-6">
        {/* Step 1 — build the web bundle */}
        <SectionCard title="1. Build the web bundle (once)" icon={PackageSearch}>
          <StepList
            steps={[
              "Do this on the computer that will run the backend (the server).",
              "Open the project folder in a terminal and run (replace the IP with the server's own IP):",
            ]}
          />
          <CodeBlock>npm run build:web -- --server http://192.168.1.50:3001</CodeBlock>
          <StepList
            steps={[
              "Wait for it to finish. This creates the web files the backend will serve.",
              "You only repeat this if the server IP changes.",
            ]}
          />
        </SectionCard>

        {/* Step 2 — start the backend */}
        <SectionCard title="2. Start the server" icon={Database}>
          <StepList
            steps={[
              "Make sure PostgreSQL is running on this computer.",
              "Start the backend (keep this window open):",
            ]}
          />
          <CodeBlock>npm run dev:backend</CodeBlock>
          <StepList
            steps={["You should see it connect to the database and listen on port 3001."]}
          />
        </SectionCard>

        {/* Step 3 — find the IP */}
        <SectionCard title="3. Find the server's IP address" icon={Terminal}>
          <StepList steps={["On the server, open Command Prompt and run:"]} />
          <CodeBlock>ipconfig</CodeBlock>
          <StepList
            steps={[
              "Note the IPv4 Address of the active connection, e.g. 192.168.1.50.",
              "This is the address everyone will use to open the web app.",
            ]}
          />
        </SectionCard>

        {/* Step 4 — access from any device */}
        <SectionCard title="4. Open it from any device on WiFi" icon={Globe}>
          <StepList
            steps={[
              "On any phone, tablet or laptop connected to the same WiFi, open the browser and go to:",
            ]}
          />
          <CodeBlock>http://192.168.1.50:3001</CodeBlock>
          <StepList
            steps={[
              "Log in with your staff PIN (e.g. admin PIN 1234).",
              "You can now view the menu, update stock when running low, take orders, and use the cashier — just like the desktop app.",
            ]}
          />
        </SectionCard>

        {/* Step 5 — what works / what doesn't */}
        <SectionCard title="5. What works in the browser" icon={MonitorSmartphone}>
          <StepList
            steps={[
              "Works: login, menu, stock & procurement, orders, cashier, reports.",
              "Desktop-only: printing receipts/kitchen tickets and detecting USB/LAN printers — those need the installed desktop app, not a browser.",
            ]}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <Lock size={20} className="text-green-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">How it all fits together</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <Globe size={16} className="mt-0.5 shrink-0 text-green-600" />
              The same single build you use for the desktop installer also powers the web — terminals install the .exe, other devices use the browser.
            </li>
            <li className="flex gap-2">
              <Terminal size={16} className="mt-0.5 shrink-0 text-green-600" />
              One command (build:web) bakes the server IP into the web bundle; the backend then serves it at port 3001.
            </li>
            <li className="flex gap-2">
              <Lock size={16} className="mt-0.5 shrink-0 text-green-600" />
              Only the server IP needs to be reachable — no port scanning or extra setup on the devices.
            </li>
          </ul>
        </Card>

        <Card className="p-6 space-y-3 border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} className="text-amber-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">Checklist — if you can't open it</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <Plug size={16} className="mt-0.5 shrink-0 text-green-600" />
              Device on the same WiFi network as the server?
            </li>
            <li className="flex gap-2">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
              Is port 3001 allowed through the server's Windows firewall? (Control Panel → Windows Defender Firewall → Advanced settings → Inbound rules → New rule → Port → TCP 3001 → Allow)
            </li>
            <li className="flex gap-2">
              <Terminal size={16} className="mt-0.5 shrink-0 text-green-600" />
              Is the backend still running (terminal window from Step 2 still open)?
            </li>
            <li className="flex gap-2">
              <Globe size={16} className="mt-0.5 shrink-0 text-green-600" />
              Did you type {"http://<server-IP>:3001"} exactly (with the port)?
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
