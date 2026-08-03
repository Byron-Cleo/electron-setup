import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import {
  Download,
  Terminal,
  PackageCheck,
  PlayCircle,
  CheckCircle2,
  ShieldAlert,
  Server,
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

export default function NodeJsGuide({ onBack }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">
        Install Node.js (Server)
      </Heading>
      <p className="text-sm text-admin-muted mb-6 text-center max-w-2xl mx-auto">
        The backend that powers the whole system runs on Node.js. It only needs to be installed on the server computer — not on the POS terminals.
      </p>

      <div className="space-y-6">
        <SectionCard title="1. Download Node.js" icon={Download}>
          <StepList
            steps={[
              "On the server computer, open https://nodejs.org in a browser.",
              "Download the latest LTS version (e.g. 22 LTS) — the LTS button on the home page.",
              "Choose the Windows Installer (.msi) for 64-bit.",
            ]}
          />
        </SectionCard>

        <SectionCard title="2. Install it" icon={PackageCheck}>
          <StepList
            steps={[
              "Run the downloaded .msi file.",
              "Keep all the default options.",
              "On the Custom Setup screen, make sure Add to PATH is enabled (it is by default). This lets the app find the node and npm commands later.",
              "Click Next until it finishes installing.",
            ]}
          />
        </SectionCard>

        <SectionCard title="3. Verify it works" icon={PlayCircle}>
          <StepList
            steps={[
              "Close the Command Prompt if it was already open, then open a new one (Windows + R, type cmd, press Enter).",
              "Run these two commands, one at a time:",
            ]}
          />
          <CodeBlock>{`node -v
npm -v`}</CodeBlock>
          <StepList
            steps={[
              "node -v should print a version like v22.14.0 and npm -v should print a number like 10.9.2.",
              "If it says 'node is not recognized', the Add to PATH option was missed — reinstall and tick it, then open a fresh Command Prompt.",
            ]}
          />
        </SectionCard>

        <SectionCard title="4. Install the project's dependencies (first time only)" icon={Terminal}>
          <StepList
            steps={[
              "Open the project folder in Command Prompt and run:",
            ]}
          />
          <CodeBlock>npm install</CodeBlock>
          <StepList
            steps={[
              "Wait for it to finish — it downloads all the parts the app needs. A few minutes the first time.",
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
            <Heading as="h3" className="text-lg text-admin-header-text">Why this matters</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <PlayCircle size={16} className="mt-0.5 shrink-0 text-green-600" />
              Every command in the other guides (npm run dev:backend, npm run build:win:network) needs Node.js installed.
            </li>
            <li className="flex gap-2">
              <Terminal size={16} className="mt-0.5 shrink-0 text-green-600" />
              npm is installed together with Node.js — no separate step.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              You install it once. There is no need to update it for day-to-day use.
            </li>
          </ul>
        </Card>

        <Card className="p-6 space-y-3 border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} className="text-amber-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">Checklist</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <Terminal size={16} className="mt-0.5 shrink-0 text-green-600" />
              node -v prints a version number starting with v.
            </li>
            <li className="flex gap-2">
              <PackageCheck size={16} className="mt-0.5 shrink-0 text-green-600" />
              npm -v prints a number.
            </li>
            <li className="flex gap-2">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
              If either command is not recognized, reopen Command Prompt, or reinstall with Add to PATH enabled.
            </li>
            <li className="flex gap-2">
              <Download size={16} className="mt-0.5 shrink-0 text-green-600" />
              Use the LTS version, not the "Current" one, for stability.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
