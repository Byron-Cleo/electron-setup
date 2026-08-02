import { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import {
  Server,
  Terminal,
  PackageCheck,
  MonitorDown,
  Wifi,
  Printer,
  Plug,
  ShieldAlert,
  Database,
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

export default function ServerInstallationGuide({ onBack }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">
        Server &amp; Installation Guide
      </Heading>
      <p className="text-sm text-admin-muted mb-6 text-center max-w-2xl mx-auto">
        Follow the sections below <span className="font-semibold text-admin-header-text">in order</span> — read, then do.
        You only set this up once per terminal.
      </p>

      <div className="space-y-6">
        {/* Step 1 — start the server */}
        <SectionCard title="1. Start the server (on the server computer)" icon={Database}>
          <StepList
            steps={[
              "Make sure PostgreSQL is running on this computer.",
              "Open the project folder in a terminal and start the backend:",
            ]}
          />
          <CodeBlock>npm run dev:backend</CodeBlock>
          <StepList
            steps={[
              "You should see the app connect to the database and start on port 3001.",
              "Leave this terminal window open while the system is in use — closing it stops the server.",
            ]}
          />
        </SectionCard>

        {/* Step 2 — find the IP */}
        <SectionCard title="2. Note the server's IP address" icon={Terminal}>
          <StepList
            steps={[
              "On the server computer, open Command Prompt and run:",
            ]}
          />
          <CodeBlock>ipconfig</CodeBlock>
          <StepList
            steps={[
              "Look for the IPv4 Address of the active connection, e.g. 192.168.1.50.",
              "Keep this IP handy — you will use it in Step 3.",
            ]}
          />
        </SectionCard>

        {/* Step 3 — build the installer */}
        <SectionCard title="3. Build the Windows installer — the easy way" icon={PackageCheck}>
          <StepList
            steps={[
              "Do this once, on any computer that has Node.js and the project installed.",
              "Run this one command from the project folder (replace the IP with yours):",
            ]}
          />
          <CodeBlock>npm run build:win:network -- --server http://192.168.1.50:3001</CodeBlock>
          <StepList
            steps={[
              "Wait for the build to finish (a few minutes the first time).",
              "The installer appears in the release folder, named something like Eraeva POS Setup 0.0.0.exe.",
              "This installer already knows your server IP — every terminal that uses it connects to that server automatically.",
            ]}
          />
        </SectionCard>

        {/* Step 4 — install */}
        <SectionCard title="4. Install the app on each terminal" icon={MonitorDown}>
          <StepList
            steps={[
              "Copy the installer to the terminal (USB drive or shared folder).",
              "Double-click the .exe and follow the wizard: Next → Install → Finish.",
              "The app opens on its own once installation completes.",
            ]}
          />
        </SectionCard>

        {/* Step 5 — connect */}
        <SectionCard title="5. Connect the terminal to the server" icon={Wifi}>
          <StepList
            steps={[
              "Open Settings → Server Connection.",
              "The API endpoint shown should already be the server IP from Step 3. If the IP ever changes, just type the new one here.",
              "Click Test Connection — the badge should turn green (Connected).",
              "Click Save Server. The terminal is now connected — no rebuild or restart needed.",
            ]}
          />
        </SectionCard>

        {/* Step 6 — printers */}
        <SectionCard title="6. Set up printers" icon={Printer}>
          <StepList
            steps={[
              "Open Settings → POS Printer Config.",
              "Click Add Printer — USB printers are detected automatically; for LAN printers enter the printer's IP.",
              "Assign each printer a role (Customer / Kitchen / Bar) and save.",
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
            <Heading as="h3" className="text-lg text-admin-header-text">How it all works</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <Wifi size={16} className="mt-0.5 shrink-0 text-green-600" />
              One computer runs the backend; every terminal talks to it over the network — orders, menu, stock and receipts all flow through the server.
            </li>
            <li className="flex gap-2">
              <Server size={16} className="mt-0.5 shrink-0 text-green-600" />
              If the server IP changes later, you do not need to rebuild — just update it in Settings → Server Connection on each terminal.
            </li>
            <li className="flex gap-2">
              <Terminal size={16} className="mt-0.5 shrink-0 text-green-600" />
              The build command bakes the IP in as the default, and the Settings screen overrides it per terminal if needed.
            </li>
          </ul>
        </Card>

        <Card className="p-6 space-y-3 border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} className="text-amber-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">Checklist — if a terminal can't connect</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <Plug size={16} className="mt-0.5 shrink-0 text-green-600" />
              Server and terminal on the same network?
            </li>
            <li className="flex gap-2">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
              Is port 3001 allowed through the server's Windows firewall? (Control Panel → Windows Defender Firewall → Advanced settings → Inbound rules → New rule → Port → TCP 3001 → Allow)
            </li>
            <li className="flex gap-2">
              <Terminal size={16} className="mt-0.5 shrink-0 text-green-600" />
              Is the backend still running (terminal window from Step 1 still open)?
            </li>
            <li className="flex gap-2">
              <Server size={16} className="mt-0.5 shrink-0 text-green-600" />
              Is the IP in Server Connection exactly the server's IPv4 address (with :3001)?
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
