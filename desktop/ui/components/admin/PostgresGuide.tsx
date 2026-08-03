import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import BackButton from "@/components/shared/BackButton"
import { Heading } from "@/components/ui/heading"
import {
  Database,
  Download,
  PlayCircle,
  Table2,
  Plug,
  ShieldAlert,
  Server,
  Terminal,
  CheckCircle2,
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
  icon: typeof Database
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

export default function PostgresGuide({ onBack }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <BackButton onClick={onBack} />
      </div>

      <Heading as="h2" className="mb-2 text-admin-header-text text-center">
        PostgreSQL Setup Guide
      </Heading>
      <p className="text-sm text-admin-muted mb-6 text-center max-w-2xl mx-auto">
        How to install the database, keep it running, create the database the app needs, and connect it to the backend.
        This is a <span className="font-semibold text-admin-header-text">one-time</span> setup on the server computer.
      </p>

      <div className="space-y-6">
        {/* Step 1 — install */}
        <SectionCard title="1. Install PostgreSQL" icon={Download}>
          <StepList
            steps={[
              "On the server computer, download the Windows installer from https://www.postgresql.org/download/windows/.",
              "Choose the latest stable version — PostgreSQL 17 or newer. Any version 13 or above works with this app.",
              "Run the installer and keep the defaults: port 5432, and the default install directory.",
              "When asked for the postgres password, type one you will remember and write it down. The app needs it in Step 4.",
              "Finish the install. Do not launch pgAdmin yet if you prefer the command line — the database can also be created in Step 3.",
            ]}
          />
        </SectionCard>

        {/* Step 2 — running */}
        <SectionCard title="2. Make sure the database server is running" icon={PlayCircle}>
          <StepList
            steps={[
              "Press Windows + R, type services.msc and press Enter.",
              "Find the service named postgresql-x64-17 (or your installed version).",
              "Its Status must say Running. If it does not, right-click it → Start.",
              "To make sure it auto-starts with the computer, right-click → Properties and set Startup type to Automatic.",
            ]}
          />
        </SectionCard>

        {/* Step 3 — create database */}
        <SectionCard title="3. Create the database (eraevadb)" icon={Table2}>
          <p className="text-sm text-admin-muted leading-relaxed">
            The app expects a database called <span className="font-mono text-admin-header-text">eraevadb</span>. Create it with pgAdmin <span className="font-semibold text-admin-header-text">or</span> the command line:
          </p>
          <StepList
            steps={[
              "pgAdmin way: open pgAdmin, expand Servers → your server → Databases, right-click Databases → Create → Database, type eraevadb, click Save.",
              "Or command line: open Command Prompt and connect as the postgres user (it asks for the password from Step 1):",
            ]}
          />
          <CodeBlock>psql -U postgres</CodeBlock>
          <StepList
            steps={[
              "Then create the database and exit:",
            ]}
          />
          <CodeBlock>{`CREATE DATABASE eraevadb;
exit`}</CodeBlock>
        </SectionCard>

        {/* Step 4 — connect */}
        <SectionCard title="4. Connect the backend to the database" icon={Plug}>
          <StepList
            steps={[
              "Open the project folder. The file backend/.env is not included in the downloaded project, so create it if it is missing: right-click in the backend folder → New → Text Document → rename it to .env.",
              "Open it with a text editor and add this line, using the postgres password from Step 1 (replace YOURPASSWORD):",
            ]}
          />
          <CodeBlock>DATABASE_URL="postgresql://postgres:YOURPASSWORD@localhost:5432/eraevadb"</CodeBlock>
          <StepList
            steps={[
              "If the server IP is not this computer (dev setup), replace localhost with that IP.",
              "Save and close the file.",
              "Generate the database client and create the app's tables — one-time commands from the project root, in this order:",
            ]}
          />
          <CodeBlock>{`npm run db:generate --prefix backend
npm run db:push --prefix backend`}</CodeBlock>
          <StepList
            steps={[
              "Both should finish with no errors. The second one creates the tables.",
            ]}
          />
        </SectionCard>

        {/* Step 5 — verify */}
        <SectionCard title="5. Verify the connection" icon={CheckCircle2}>
          <StepList
            steps={[
              "Start the backend (leave this terminal open — closing it stops the server):",
            ]}
          />
          <CodeBlock>npm run dev:backend</CodeBlock>
          <StepList
            steps={[
              "You should see the app connect to the database and start on port 3001.",
              "If it starts, the database is installed, running and connected. Continue with the Server & Installation Guide step 2 to create the first admin.",
            ]}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <Database size={20} className="text-green-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">Why this matters</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <Server size={16} className="mt-0.5 shrink-0 text-green-600" />
              The database stores every order, menu item, stock record and user account. Without it the server has nowhere to keep data.
            </li>
            <li className="flex gap-2">
              <Terminal size={16} className="mt-0.5 shrink-0 text-green-600" />
              It runs as a background service — the terminal is free to use even while PostgreSQL works.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              You install it once. Backups can be made from pgAdmin later by right-clicking the database → Backup.
            </li>
          </ul>
        </Card>

        <Card className="p-6 space-y-3 border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} className="text-amber-600" />
            </div>
            <Heading as="h3" className="text-lg text-admin-header-text">Checklist — if the backend can't connect</Heading>
          </div>
          <ul className="space-y-2 text-sm text-admin-muted leading-relaxed">
            <li className="flex gap-2">
              <PlayCircle size={16} className="mt-0.5 shrink-0 text-green-600" />
              Is the PostgreSQL service still Running? (services.msc — see Step 2)
            </li>
            <li className="flex gap-2">
              <Plug size={16} className="mt-0.5 shrink-0 text-green-600" />
              Does backend/.env use the correct password, port 5432 and database name eraevadb?
            </li>
            <li className="flex gap-2">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
              Is port 5432 allowed through the Windows firewall? (Control Panel → Windows Defender Firewall → Advanced settings → Inbound rules → New rule → Port → TCP 5432 → Allow)
            </li>
            <li className="flex gap-2">
              <Terminal size={16} className="mt-0.5 shrink-0 text-green-600" />
              Were npm run db:generate and npm run db:push run after creating the database?
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
