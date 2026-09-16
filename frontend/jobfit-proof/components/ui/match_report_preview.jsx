const mockResult = {
  jobTitle: "Frontend Developer — React/TypeScript",
  scoreTotal: 78,
  resumen:
    "Cumplís la mayoría de los requisitos técnicos. La principal brecha es la falta de experiencia liderando equipos.",
  requisitos: [
    {
      requisito: "3+ años de experiencia con React",
      categoria: "excluyente",
      cumple: "si",
      evidencia: "CV menciona 4 años como Frontend Developer usando React y Next.js.",
    },
    {
      requisito: "TypeScript en producción",
      categoria: "excluyente",
      cumple: "si",
      evidencia: "Experiencia con TypeScript mencionada en 3 de 4 empleos listados.",
    },
    {
      requisito: "Inglés avanzado",
      categoria: "deseable",
      cumple: "parcial",
      evidencia: "CV menciona inglés intermedio, sin certificación formal.",
    },
    {
      requisito: "Liderazgo de equipos de 3+ personas",
      categoria: "deseable",
      cumple: "no",
      evidencia: "No se encontró mención de gestión o liderazgo de personas.",
    },
    {
      requisito: "Experiencia con testing (Jest, Cypress)",
      categoria: "deseable",
      cumple: "si",
      evidencia: "Se menciona uso de Jest en dos proyectos.",
    },
  ],
};

const statusConfig = {
  si: { glyph: "OK", color: "#4E9F72" },
  parcial: { glyph: "~~", color: "#D98E3B" },
  no: { glyph: "--", color: "#D9574A" },
};

export default function MatchReportPreview() {
  const r = mockResult;
  return (
    <div className="min-h-screen bg-[#F7F4EF] text-[#14181F] font-sans">
      <div className="max-w-2xl mx-auto px-6 py-12 md:py-16">
        <div className="flex items-center justify-between mb-10">
          <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#14181F]/60">
            fitscore
          </span>
          <button className="text-xs font-mono uppercase tracking-wide border border-[#14181F]/20 rounded px-3 py-1.5 hover:bg-[#14181F]/5 transition-colors">
            Compartir
          </button>
        </div>

        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-[#14181F]/50 mb-2">
            Resultado del análisis
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold mb-3">{r.jobTitle}</h1>
          <p className="text-[15px] leading-relaxed text-[#14181F]/70 max-w-lg">
            {r.resumen}
          </p>
        </div>

        <div className="rounded-lg overflow-hidden bg-[#12161C] shadow-[0_20px_50px_-15px_rgba(18,22,28,0.4)]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D9574A]/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#D98E3B]/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#4E9F72]/70" />
            <span className="ml-2 font-mono text-[11px] text-white/40">
              match_report.log
            </span>
          </div>

          <div className="px-6 py-8 flex items-end justify-between border-b border-white/10">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40 mb-1">
                Match score
              </p>
              <p className="font-mono text-6xl font-bold text-white leading-none">
                {r.scoreTotal}
                <span className="text-2xl text-white/40">%</span>
              </p>
            </div>
            <div className="w-28 h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-[#4E9F72] rounded-full"
                style={{ width: `${r.scoreTotal}%` }}
              />
            </div>
          </div>

          <div>
            {r.requisitos.map((req, i) => {
              const s = statusConfig[req.cumple];
              return (
                <div
                  key={i}
                  className="px-6 py-4 border-b border-white/[0.06] last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0"
                      style={{ color: s.color, backgroundColor: `${s.color}1A` }}
                    >
                      [{s.glyph}]
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] text-white/90">{req.requisito}</p>
                        <span className="font-mono text-[9px] uppercase tracking-wide text-white/30 border border-white/10 rounded px-1.5 py-0.5">
                          {req.categoria}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-white/40 mt-1 leading-relaxed">
                        {req.evidencia}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-[11px] font-mono text-[#14181F]/30 mt-8 uppercase tracking-wide">
          Generado con IA — verifica   los resultados antes de postularte
        </p>
      </div>
    </div>
  );
}
