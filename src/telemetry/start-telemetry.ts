import { NodeSDK } from '@opentelemetry/sdk-node';

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';

import { resourceFromAttributes } from '@opentelemetry/resources';

import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

export function startTelemetry(serviceName: string): NodeSDK {
  const traceExporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
      'http://localhost:4318/v1/traces',
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),

    traceExporter,

    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },

        '@opentelemetry/instrumentation-kafkajs': {
          enabled: false,
        },
      }),
    ],
  });

  sdk.start();

  return sdk;
}
