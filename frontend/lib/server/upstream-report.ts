import { parseAnalysisReport, type Report } from "../analysis-report";
import type { AnalysisRequestInput } from "../analysis-input";

const maxReportBytes = 256 * 1024;

/** Keep the upstream deadline active while reading a bounded UTF-8 response. */
export async function readUpstreamReport(response: Response, signal: AbortSignal, input: AnalysisRequestInput): Promise<Report> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing analysis report");

  const bytes = new Uint8Array(maxReportBytes);
  let size = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });

  try {
    signal.throwIfAborted();
    while (true) {
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      if (size + chunk.value.byteLength > maxReportBytes) throw new Error("Analysis report is too large");
      bytes.set(chunk.value, size);
      size += chunk.value.byteLength;
    }

    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size));
    const report = parseAnalysisReport(JSON.parse(text), input);
    if (!report) throw new Error("Invalid analysis report");
    return report;
  } finally {
    signal.removeEventListener("abort", cancel);
    cancel();
    reader.releaseLock();
  }
}
