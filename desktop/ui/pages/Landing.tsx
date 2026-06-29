import { Link } from "react-router-dom"
import { ArrowLeft, Terminal } from "lucide-react"

function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col justify-center items-center py-12 px-4 font-sans">
      <div className="w-full max-w-md bg-[#141b2d] rounded-3xl p-8 border border-slate-800 text-center shadow-2xl shadow-black/40">
        <div className="w-16 h-16 bg-[#f5a623]/10 border border-[#f5a623]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Terminal className="w-8 h-8 text-[#f5a623]" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          LANDING PAGE
        </h1>
        
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          Welcome to the Eraeva POS main workspace. You have successfully authenticated.
        </p>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-medium rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-600"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Login</span>
        </Link>
      </div>
    </div>
  )
}

export default Landing
