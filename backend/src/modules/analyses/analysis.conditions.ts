const practicalConditionPatterns = [
  /\b(?:working hours|work schedule|time[- ]?zone|uk\/?cet|daily stand[- ]?up|office attendance|hybrid working|on[- ]?site working|start date|notice period)\b/i,
  /\b(?:willingness|availability|available|willing|able)\b.{0,60}\b(?:travel|relocate|relocation|work.*hours|start)\b/i,
  /\b(?:occasional|regular|business) travel\b/i,
  /\b(?:horario|jornada|huso horario|presencialidad|trabajo h[ií]brido|fecha de incorporaci[oó]n|preaviso)\b/i,
  /\b(?:disponibilidad|dispuesto)\b.{0,60}\b(?:viajar|mudarse|trasladarse|incorporarse)\b/i,
];

export function isPracticalCondition(label: string): boolean {
  return practicalConditionPatterns.some((pattern) => pattern.test(label));
}
