import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import {
  Printer,
  Plug,
  MonitorDown,
  Settings2,
  CheckCircle2,
  ShieldAlert,
  Wifi,
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

export default function PrinterDriversGuide({ onBack }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">
        Install Printer Drivers
      </Heading>
      <p className="text-sm text-admin-muted mb-6 text-center max-w-2xl mx-auto">
        Receipt printers need their driver installed on every computer that prints. Do this once per terminal, then connect the printer in the app.
      </p>

      <div className="space-y-6">
        <SectionCard title="1. Get the right driver" icon={MonitorDown}>
          <StepList
            steps={[
              "Check the printer model on the printer label (e.g. Epson TM-T20II, Star TSP143, Bixolon).",
              "Download the driver for that exact model from the manufacturer's website.",
              "Match the Windows version on the terminal (64-bit).",
            ]}
          />
        </SectionCard>

        <SectionCard title="2. Install the driver" icon={Plug}>
          <StepList
            steps={[
              "Run the downloaded driver installer and follow the wizard.",
              "Connect the printer by USB when asked (or during the wizard).",
              "USB printers are installed automatically once the driver is in — Windows recognises the printer when you plug it in.",
            ]}
          />
        </SectionCard>

        <SectionCard title="3. Verify in Windows" icon={CheckCircle2}>
          <StepList
            steps={[
              "Open Windows Settings → Bluetooth & devices → Printers & scanners.",
              "The printer should be listed.",
              "Click it → Print test page. A test receipt should print.",
            ]}
          />
        </SectionCard>

        <SectionCard title="4. LAN printers (optional)" icon={Wifi}>
          <StepList
            steps={[
              "Printers on the network need a fixed IP so the app always finds them.",
              "Set the printer to a static IP (see the printer's manual — usually via its front panel or a web page).",
              "Note the IP and port, e.g. 192.168.1.60.",
            ]}
          />
        </SectionCard>

        <SectionCard title="5. Connect it in the app" icon={Settings2}>
          <StepList
            steps={[
              "Open Settings → POS Printer Config.",
              "Click Add Printer — USB printers are detected automatically; for LAN printers enter the printer's IP.",
              "Assign the printer a role: Customer (receipt for the customer), Kitchen (kitchen ticket), or Bar.",
              "Save, then run a test print from the same screen.",
            ]}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <Printer size={20} className="text-green-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">How it all works</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <Plug size={16} className="mt-0.5 shrink-0 text-green-600" />
              The driver makes Windows talk to the printer; the app then prints through Windows.
            </li>
            <li className="flex gap-2">
              <Printer size={16} className="mt-0.5 shrink-0 text-green-600" />
              Each terminal that prints needs its own driver install — a shared network printer on one computer does not print from others.
            </li>
            <li className="flex gap-2">
              <Settings2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              Assigning roles (Customer / Kitchen / Bar) tells the app which receipts go to which printer.
            </li>
          </ul>
        </Card>

        <Card className="p-6 space-y-3 border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} className="text-amber-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">Checklist — if it doesn't print</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              Does the printer appear in Printers & scanners, and does a test page print?
            </li>
            <li className="flex gap-2">
              <Plug size={16} className="mt-0.5 shrink-0 text-green-600" />
              Is the USB cable fully plugged in, or is the LAN printer on the network?
            </li>
            <li className="flex gap-2">
              <Settings2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              Is the printer added in POS Printer Config with a role?
            </li>
            <li className="flex gap-2">
              <Wifi size={16} className="mt-0.5 shrink-0 text-green-600" />
              For LAN printers — is the IP correct and does the printer have a fixed IP?
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
