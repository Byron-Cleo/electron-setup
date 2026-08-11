import { Outlet } from "react-router-dom"
import { WaiterHeader } from "./WaiterHeader"
import { WaiterOrderProvider } from "./WaiterOrderContext"

export function WaiterLayout() {
  return (
    <div className="h-screen bg-brand-light/20 flex flex-col">
      <div className="w-full mx-auto max-w-[1400px] flex-1 flex flex-col">
        <WaiterOrderProvider>
          <WaiterHeader />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </WaiterOrderProvider>
      </div>
    </div>
  )
}

export default WaiterLayout
