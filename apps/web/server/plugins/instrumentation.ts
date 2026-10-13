import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Same opt-in contract as apps/cms/instrumentation.ts: monitoring is a
// separately-sold add-on (the actual Grafana/Loki/Prometheus backend lives
// in its own, independently-deployed project, not this repo), not
// something every Polysite deployment pays the cost of by default. No
// OTEL_EXPORTER_OTLP_ENDPOINT means this plugin does nothing at all.
export default defineNitroPlugin(() => {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "web",
    }),
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
});
