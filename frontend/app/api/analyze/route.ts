import { proxyAnalysis } from "../../../lib/server/analysis-proxy";

export const runtime = "nodejs";

export function POST(request: Request) {
  return proxyAnalysis(request);
}
