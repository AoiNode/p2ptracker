import { formatIDR } from "@/lib/utils";

export default function StatCards({inflow, outflow}:{inflow:number; outflow:number}){
  return (
    <div className="grid grid-cols-2 gap-4 mt-4">
      <div className="rounded-2xl p-4 bg-white/10 border border-white/20 backdrop-blur">
        <div className="text-white/80 text-sm">Uang Masuk</div>
        <div className="text-2xl font-semibold">{formatIDR(inflow)}</div>
      </div>
      <div className="rounded-2xl p-4 bg-white/10 border border-white/20 backdrop-blur">
        <div className="text-white/80 text-sm">Uang Keluar</div>
        <div className="text-2xl font-semibold">{formatIDR(outflow)}</div>
      </div>
    </div>
  )
}
