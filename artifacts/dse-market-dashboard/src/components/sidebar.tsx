import { Activity, Database, LineChart } from 'lucide-react';
import { useLocation } from 'wouter';

type ActivePage = 'overview' | 'historical' | 'ingestion';

const navigation = [
  { id: 'overview' as const, href: '/', label: 'Live overview', icon: Activity },
  { id: 'historical' as const, href: '/historical', label: 'Historical explorer', icon: LineChart },
  { id: 'ingestion' as const, href: '/ingestion', label: 'Ingestion monitor', icon: Database },
];

export function Sidebar({ active }: { active: ActivePage }) {
  const [, navigate] = useLocation();
  return <aside className="hidden w-[224px] shrink-0 flex-col border-r border-[#364150] bg-[#18212c] text-slate-300 md:flex">
    <div className="flex h-[70px] items-center gap-3 border-b border-[#364150] px-5"><div className="grid size-8 place-items-center rounded bg-[#f4c95d] text-[#18212c]"><BarChartIcon /></div><div><p className="font-mono text-[10px] font-medium uppercase tracking-[.18em] text-[#f4c95d]">DSE</p><p className="text-sm font-semibold text-white">Market ops</p></div></div>
    <div className="px-3 py-6"><p className="px-2 font-mono text-[9px] uppercase tracking-[.18em] text-slate-500">Workspace</p><nav className="mt-3 space-y-1" aria-label="Dashboard pages">{navigation.map((item) => { const Icon = item.icon; const selected = item.id === active; return <button key={item.id} type="button" onClick={() => navigate(item.href)} aria-current={selected ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs transition-colors ${selected ? 'bg-[#2a3542] font-semibold text-white' : 'text-slate-400 hover:bg-[#222d39] hover:text-white'}`}><Icon size={15} className={selected ? 'text-[#f4c95d]' : undefined} /> {item.label}</button>; })}</nav></div>
  </aside>;
}

function BarChartIcon() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 16v-5M12 16V7M17 16v-3" /></svg>; }
