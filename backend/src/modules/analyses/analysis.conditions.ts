// Only recognise practical job arrangements here, not technical uses of similar words.
const conditionPatterns = [
  /\b(?:working|work|office|core|business)\s+hours\b/,
  /\b(?:work(?:ing)?\s+schedule|horarios?\s+(?:laboral(?:es)?|de\s+trabajo)|jornada\s+laboral)\b/,
  /\b(?:time[ -]?zone\s+overlap|overlap(?:ping)?\s+(?:with\s+)?(?:uk|cet|gmt|utc)|solapamiento\s+horario)\b/,
  /\b(?:daily\s+stand[ -]?up\s+at|reunion\s+diaria\s+a\s+las)\b/,
  /\b(?:willing(?:ness)?\s+to\s+(?:travel|relocate)|disposicion\s+(?:a|para)\s+(?:viajar|trasladarse|reubicarse))\b/,
  /\b(?:travel\s+availability|availability\s+(?:to\s+(?:travel|start)|for\s+(?:shifts|weekends))|disponibilidad\s+para\s+(?:viajar|incorporarse|trabajar))\b/,
  /\b(?:relocation|reubicacion|incorporacion|notice\s+period|start\s+date|fecha\s+de\s+inicio)\b/,
  /\b(?:presencialidad|modalidad\s+(?:hibrida|presencial)|(?:hybrid|on[ -]?site)\s+(?:work(?:ing)?|attendance|schedule)|office\s+attendance|asistencia\s+(?:a|en)\s+la\s+oficina)\b/
];

export function isPracticalCondition(label: string): boolean {
  const normalised = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return conditionPatterns.some((pattern) => pattern.test(normalised));
}
