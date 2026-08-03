import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import {
  PackageCheck,
  MonitorDown,
  Terminal,
  Wifi,
  Server,
  ShieldAlert,
  CheckCircle2,
  Download,
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

export default function BuildInstallerGuide({ onBack }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">
        Build the Windows Installer
      </Heading>
      <p className="text-sm text-admin-muted mb-6 text-center max-w-2xl mx-auto">
        One command turns the app into a .exe installer that already knows your server. Every POS terminal then installs the same file.
      </p>

      <div className="space-y-6">
        <SectionCard title="1. Do this on a Windows computer" icon={MonitorDown}>
          <StepList
            steps={[
              "The Windows installer is built on a Windows computer (the build tool needs Windows).",
              "It is a one-time job — after this you only rebuild if the app itself changes.",
              "You need: Node.js installed, the project folder on this computer, and npm install already run (see Install Node.js guide).",
            ]}
          />
        </SectionCard>

        <SectionCard title="2. Note the server's IP address" icon={Wifi}>
          <StepList
            steps={[
              "The installer remembers the server so terminals connect automatically.",
              "Open Command Prompt and run:",
            ]}
          />
          <CodeBlock>ipconfig</CodeBlock>
          <StepList
            steps={[
              "Copy the IPv4 Address of the active connection, e.g. 192.168.1.50.",
            ]}
          />
        </SectionCard>

        <SectionCard title="3. Run the build" icon={PackageCheck}>
          <StepList
            steps={[
              "From the project folder, run this one command (replace the IP with yours):",
            ]}
          />
          <CodeBlock>npm run build:win:network -- --server http://192.168.1.50:3001</CodeBlock>
          <StepList
            steps={[
              "The first build downloads Electron and packages the app — a few minutes.",
              "Wait until it finishes with no errors.",
            ]}
          />
        </SectionCard>

        <SectionCard title="4. Find the installer" icon={Download}>
          <StepList
            steps={[
              "Open the release folder next to the project folder.",
              "Look for Eraeva POS Billing System-0.0.0-win-x64.exe (the installer) — about 80 MB.",
              "Copy it to a USB drive or shared folder to install on every terminal.",
            ]}
          />
        </SectionCard>

        <SectionCard title="5. Install on each terminal" icon={MonitorDown}>
          <StepList
            steps={[
              "Copy the .exe to the terminal and double-click it.",
              "If Windows SmartScreen appears, click More info → Run anyway (the app is self-signed).",
              "Follow the wizard: Next → choose install location → Install → Finish.",
              "The app opens by itself when installation finishes.",
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
              The command bakes the server address in as the default, so terminals find the server with no setup.
            </li>
            <li className="flex gap-2">
              <Server size={16} className="mt-0.5 shrink-0 text-green-600" />
              If the server IP changes later, you do not rebuild — just update Settings → Server Connection on each terminal.
            </li>
            <li className="flex gap-2">
              <Terminal size={16} className="mt-0.5 shrink-0 text-green-600" />
              Build once, reuse the same file for every terminal.
            </li>
          </ul>
        </Card>

        <Card className="p-6 space-y-3 border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} className="text-amber-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">Checklist — if the build fails</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              Is Node.js installed and npm install already run? (See Install Node.js guide.)
            </li>
            <li className="flex gap-2">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
              Antivirus may pause the build — allow it and retry.
            </li>
            <li className="flex gap-2">
              <Terminal size={16} className="mt-0.5 shrink-0 text-green-600" />
              Does the command show no red errors before finishing?
            </li>
            <li className="flex gap-2">
              <Wifi size={16} className="mt-0.5 shrink-0 text-green-600" />
              Is the IP exactly the server's IPv4 (with :3001)? Rebuild with the right IP if not.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
