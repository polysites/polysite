import { registerOTel } from "@vercel/otel";

// Opt-in, not opt-out: monitoring is meant to be a separately-sold add-on
// (a different, independently-deployed project owns the actual Grafana/
// Loki/Prometheus backend), not something baked into every Polysite
// deployment. No OTEL_EXPORTER_OTLP_ENDPOINT configured means this is a
// complete no-op -- no SDK init, no attempted network connections, zero
// overhead for a customer who hasn't enabled it.
//
// registerOTel reads the standard OTEL_EXPORTER_OTLP_* env vars itself for
// the endpoint/headers/protocol -- nothing to hand-wire here.
export function register() {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || "cms",
  });
}
