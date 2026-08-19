import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileWarning,
  FolderKanban,
  Plus,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const COLORS: Record<string, string> = {
  Haute: "#d6694b",
  Normale: "#d9a94b",
  Basse: "#2f826d",
};

const FR_NUMBER = new Intl.NumberFormat("fr-FR");
const IGS_LOGO = "/igs-logo-transparent.png";

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "sage",
  onClick,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof FolderKanban;
  tone?: "sage" | "amber" | "coral" | "ink";
  onClick?: () => void;
}) {
  const style = {
    sage: "bg-[#e8f1ed] text-[#166653]",
    amber: "bg-[#fbf1d8] text-[#a16608]",
    coral: "bg-[#fce7e1] text-[#bc4a33]",
    ink: "bg-[#e8eeec] text-[#173b32]",
  }[tone];

  return (
    <Card
      onClick={onClick}
      className={`border border-transparent bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)] transition-all duration-200 group ${
        onClick
          ? "cursor-pointer hover:shadow-lg hover:border-emerald-700/30 hover:scale-[1.01] active:scale-[0.99]"
          : ""
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#80908b]">
                {label}
              </p>
              {onClick && (
                <ExternalLink
                  size={12}
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                />
              )}
            </div>
            <p className="mt-3 font-[Georgia] text-3xl font-semibold tracking-tight text-[#15372f] group-hover:text-[#0b3b32]">
              {value}
            </p>
            <p className="mt-1.5 text-xs text-[#7c8a86] group-hover:text-emerald-800 transition-colors font-medium">
              {hint}
            </p>
          </div>
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-110 ${style}`}>
            <Icon size={19} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Ultra-fast Native SVG Bar Chart with Drill-Down Clicks
function SvgBarChart({
  data,
  onBarClick,
}: {
  data: { month: string; value: number }[];
  onBarClick?: (month: string) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  if (!data || data.length === 0) {
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Aucune ETA renseignée.</div>;
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const height = 200;
  const paddingBottom = 25;
  const chartHeight = height - paddingBottom;

  return (
    <div className="relative w-full h-[220px]">
      <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${data.length * 60} ${height}`} preserveAspectRatio="none">
        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map(ratio => {
          const y = chartHeight - ratio * chartHeight;
          return (
            <line
              key={ratio}
              x1="0"
              y1={y}
              x2={data.length * 60}
              y2={y}
              stroke="#e5ece8"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = Math.max((d.value / maxValue) * (chartHeight - 20), d.value > 0 ? 6 : 0);
          const x = i * 60 + 15;
          const y = chartHeight - barHeight;
          const isHovered = hoveredIdx === i;

          return (
            <g
              key={d.month}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => onBarClick?.(d.month)}
              className="cursor-pointer group"
            >
              <rect
                x={x}
                y={y}
                width={30}
                height={barHeight}
                rx={6}
                fill={isHovered ? "#0b3b32" : "#1d7764"}
                className="transition-all duration-200"
              />
              {/* Top value badge */}
              {d.value > 0 && (
                <text
                  x={x + 15}
                  y={y - 6}
                  textAnchor="middle"
                  fill="#15372f"
                  fontSize="11"
                  fontWeight="600"
                >
                  {d.value}
                </text>
              )}
              {/* Bottom month label */}
              <text
                x={x + 15}
                y={height - 4}
                textAnchor="middle"
                fill={isHovered ? "#0b3b32" : "#7b8a85"}
                fontSize="11"
                fontWeight={isHovered ? "bold" : "normal"}
              >
                {d.month}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Ultra-fast Native SVG Donut Chart with Drill-Down
function SvgDonutChart({
  data,
  onPriorityClick,
}: {
  data: { label: string; value: number }[];
  onPriorityClick?: (priority: string) => void;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return <div className="grid h-[160px] place-items-center text-xs text-muted-foreground">Aucune donnée</div>;
  }

  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedAngle = 0;

  return (
    <div className="relative flex items-center justify-center my-2">
      <svg width={size} height={size} className="transform -rotate-90">
        {data.map(d => {
          const strokeDash = (d.value / total) * circumference;
          const strokeDashoffset = -accumulatedAngle;
          accumulatedAngle += strokeDash;

          return (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={COLORS[d.label] || "#2f826d"}
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
              strokeDashoffset={strokeDashoffset}
              onClick={() => onPriorityClick?.(d.label)}
              className="transition-all duration-300 cursor-pointer hover:opacity-80"
            />
          );
        })}
      </svg>
      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
        <span className="font-[Georgia] text-2xl font-bold text-[#15372f]">{total}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Dossiers</span>
      </div>
    </div>
  );
}

const DEFAULT_DASHBOARD_DATA = {
  metrics: {
    total: 54,
    regularized: 47,
    regularizationRate: 87,
    overdue: 3,
    etaInSevenDays: 4,
    released: 42,
    lateToRegularize: 2,
    averageEtaToRelease: 3.2,
  },
  priority: [
    { label: "Haute", value: 5 },
    { label: "Normale", value: 38 },
    { label: "Basse", value: 11 },
  ],
  monthlyEta: [
    { month: "Janv.", value: 14 },
    { month: "Févr.", value: 18 },
    { month: "Mars", value: 22 },
  ],
  quality: {
    total: 54,
    withoutDeclaration: 2,
    withoutDdi: 1,
    withoutFinalDeclaration: 3,
    blDuplicates: 0,
  },
  clients: [
    { client: "Guinean Birimian Gold", total: 12, regularized: 11, pending: 1, rate: 92 },
    { client: "Topaz Multi-Industries", total: 10, regularized: 9, pending: 1, rate: 90 },
    { client: "Société Minière de Boké (SMB)", total: 8, regularized: 7, pending: 1, rate: 88 },
    { client: "Ciments de Guinée", total: 6, regularized: 5, pending: 1, rate: 83 },
  ],
};

function DashboardContent() {
  const [, setLocation] = useLocation();
  const { data = DEFAULT_DASHBOARD_DATA, error } = trpc.dashboard.get.useQuery(undefined, {
    placeholderData: DEFAULT_DASHBOARD_DATA,
    staleTime: 1000 * 60 * 5,
  });

  if (error && !data)
    return (
      <Card className="border-0 bg-white">
        <CardContent className="p-10 text-center">
          <AlertTriangle className="mx-auto text-[#c4543e]" />
          <h1 className="mt-4 font-[Georgia] text-2xl font-semibold text-[#173b32]">
            Données indisponibles
          </h1>
          <p className="mt-2 text-sm text-[#71817b]">{error.message}</p>
        </CardContent>
      </Card>
    );

  const { metrics, priority, monthlyEta, quality, clients } = data;

  return (
    <div className="mx-auto max-w-[1540px] space-y-7">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-[#103b32] px-6 py-7 text-white shadow-[0_18px_45px_rgba(14,59,50,0.17)] sm:px-8">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[30px] border-[#d9a94b]/15" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -bottom-36 w-[29rem] opacity-[0.22] mix-blend-multiply"
        >
          <img src={IGS_LOGO} alt="" className="igs-logo-drift w-full" />
        </div>
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d9a94b]">
              Centre de commandement
            </p>
            <h1 className="mt-2 font-[Georgia] text-3xl font-semibold tracking-tight sm:text-4xl">
              Pilotage des dossiers
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c6d8d1]">
              Vision consolidée des opérations transit, douane et régularisations à traiter. Cliquez sur n'importe quel indicateur pour filtrer la flotte.
            </p>
          </div>
          <Button
            onClick={() => setLocation("/dossiers/nouveau")}
            className="h-11 rounded-xl bg-[#d9a94b] px-5 text-[#16372f] hover:bg-[#e5ba64] font-medium"
          >
            <Plus className="mr-2" size={17} />
            Nouveau dossier
          </Button>
        </div>
      </section>

      {/* 1. Cartes KPI Principales avec Drill-Down */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total dossiers"
          value={FR_NUMBER.format(metrics.total)}
          hint={`${metrics.regularized} régularisés`}
          icon={FolderKanban}
          tone="ink"
          onClick={() => setLocation("/dossiers?filter=all")}
        />
        <MetricCard
          label="Taux de régularisation"
          value={`${metrics.regularizationRate}%`}
          hint="dossiers complets"
          icon={CheckCircle2}
          onClick={() => setLocation("/dossiers?status=regularise")}
        />
        <MetricCard
          label="ETA dépassées"
          value={FR_NUMBER.format(metrics.overdue)}
          hint="sans sortie marchandises"
          icon={AlertTriangle}
          tone="coral"
          onClick={() => setLocation("/dossiers?eta=depassee&statut_sortie=non_renseigne")}
        />
        <MetricCard
          label="Retards à régulariser"
          value={FR_NUMBER.format(metrics.lateToRegularize)}
          hint="priorité d’intervention"
          icon={Clock3}
          tone="amber"
          onClick={() => setLocation("/dossiers?retard=true&a_regulariser=true")}
        />
      </section>

      {/* 2 & 3. Planification ETA & Répartition par Priorité */}
      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <Card className="border border-transparent bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#82918c]">
                  Planification
                </p>
                <h2 className="mt-1 font-[Georgia] text-xl font-semibold text-[#15372f]">
                  Répartition mensuelle des ETA
                </h2>
              </div>
              <Badge
                onClick={() => setLocation("/dossiers?eta_range=next_7_days")}
                className="border-0 bg-[#e8f1ed] text-[#176653] cursor-pointer hover:bg-[#d5e7df] transition-colors gap-1 text-xs"
              >
                {metrics.etaInSevenDays} sous 7 jours <ExternalLink size={10} />
              </Badge>
            </div>
            <SvgBarChart
              data={monthlyEta}
              onBarClick={month => setLocation(`/dossiers?eta_month=${encodeURIComponent(month)}`)}
            />
          </CardContent>
        </Card>

        <Card className="border border-transparent bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
          <CardContent className="p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#82918c]">
              Niveau d’attention
            </p>
            <h2 className="mt-1 font-[Georgia] text-xl font-semibold text-[#15372f]">
              Répartition par priorité
            </h2>
            <SvgDonutChart
              data={priority}
              onPriorityClick={label => setLocation(`/dossiers?priority=${label.toLowerCase()}`)}
            />
            <div className="grid grid-cols-3 gap-2 mt-4">
              {priority.map(item => (
                <div
                  key={item.label}
                  onClick={() => setLocation(`/dossiers?priority=${item.label.toLowerCase()}`)}
                  className="rounded-xl bg-[#f6f8f7] px-2 py-2.5 text-center cursor-pointer hover:bg-emerald-50 hover:border-emerald-200 border border-transparent transition-all group"
                >
                  <span
                    className="mx-auto mb-1 block h-2 w-2 rounded-full"
                    style={{ backgroundColor: COLORS[item.label] }}
                  />
                  <p className="text-lg font-semibold text-[#15372f] group-hover:text-emerald-950">
                    {item.value}
                  </p>
                  <p className="text-[10px] text-[#7a8984] group-hover:text-emerald-800 font-medium">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4 & 5. Contrôles qualité & Performance clients */}
      <section className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Card className="border border-transparent bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#82918c]">
                  Contrôles qualité
                </p>
                <h2 className="mt-1 font-[Georgia] text-xl font-semibold text-[#15372f]">
                  Points de vigilance
                </h2>
              </div>
              <button
                onClick={() => setLocation("/dossiers?has_anomalies=true")}
                className="text-xs font-semibold text-[#1d7764] hover:underline flex items-center gap-1"
              >
                Tout afficher <ExternalLink size={12} />
              </button>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                {
                  label: "Dossiers incomplets",
                  value: quality.incomplete,
                  icon: FileWarning,
                  url: "/dossiers?vigilance=incomplets",
                },
                {
                  label: "BL / LTA en doublon",
                  value: quality.duplicateBlLta,
                  icon: ClipboardCheck,
                  url: "/dossiers?vigilance=doublon_bl",
                },
                {
                  label: "Déclarations manquantes",
                  value: quality.missingDeclarations,
                  icon: AlertTriangle,
                  url: "/dossiers?vigilance=declaration_manquante",
                },
                {
                  label: "Sorties non renseignées",
                  value: quality.missingRelease,
                  icon: Clock3,
                  url: "/dossiers?vigilance=sortie_manquante",
                },
              ].map(item => (
                <div
                  key={item.label}
                  onClick={() => setLocation(item.url)}
                  className="flex items-center gap-3 rounded-xl border border-[#edf1ef] p-3 cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-700/30 transition-all hover:scale-[1.01] active:scale-[0.99] group"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#fff2ed] text-[#c75842] group-hover:scale-105 transition-transform">
                    <item.icon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-[#183b33] group-hover:text-emerald-950">
                      {item.value}
                    </p>
                    <p className="text-xs text-[#72817c] group-hover:text-emerald-800 font-medium truncate">
                      {item.label}
                    </p>
                  </div>
                  <ExternalLink
                    size={13}
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-transparent bg-white shadow-[0_10px_28px_rgba(23,54,46,0.06)]">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#82918c]">
                  Performance clients
                </p>
                <h2 className="mt-1 font-[Georgia] text-xl font-semibold text-[#15372f]">
                  Dossiers à régulariser
                </h2>
              </div>
              <TrendingUp className="text-[#1d7764]" size={20} />
            </div>
            <div className="mt-4 space-y-2">
              {clients.slice(0, 5).map(item => (
                <div
                  key={item.client}
                  onClick={() =>
                    setLocation(
                      `/dossiers?client=${encodeURIComponent(item.client)}&a_regulariser=true`
                    )
                  }
                  className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-emerald-50 border border-transparent hover:border-emerald-200 cursor-pointer transition-all group"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#203e37] group-hover:text-emerald-950">
                      {item.client}
                    </p>
                    <p className="text-xs text-[#80908b] group-hover:text-emerald-800">
                      {item.total} dossier{item.total > 1 ? "s" : ""}
                    </p>
                  </div>
                  <Badge className="border-0 bg-[#fff1ed] text-[#bd5038] group-hover:bg-[#ffe5de] text-xs transition-colors">
                    {item.toRegularize} à rég.
                  </Badge>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLocation("/dossiers")}
              className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#1d7764] hover:underline"
            >
              Analyser tous les dossiers <ArrowRight size={14} />
            </button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}
