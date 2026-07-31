import { Outlet } from "react-router-dom"
import { WaiterHeader } from "./WaiterHeader"

export function WaiterLayout() {
  return (
    <div className="h-screen bg-brand-light flex flex-col">
      <div className="w-full mx-auto max-w-[1400px] flex-1 flex flex-col">
        <WaiterHeader />
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default WaiterLayout
