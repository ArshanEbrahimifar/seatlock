import {
  context as otelContext,
  propagation,
  ROOT_CONTEXT,
  type Context,
} from '@opentelemetry/api';

export type TraceCarrier = Record<string, string>;

export function captureTraceContext(): TraceCarrier {
  const carrier: TraceCarrier = {};

  propagation.inject(otelContext.active(), carrier);

  return carrier;
}

export function extractTraceContext(carrier?: TraceCarrier): Context {
  return propagation.extract(ROOT_CONTEXT, carrier ?? {});
}

export function kafkaHeadersToCarrier(
  headers?: Record<string, unknown>,
): TraceCarrier {
  const carrier: TraceCarrier = {};

  if (!headers) {
    return carrier;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      carrier[key] = value;
      continue;
    }

    if (Buffer.isBuffer(value)) {
      carrier[key] = value.toString('utf8');
      continue;
    }

    if (Array.isArray(value)) {
      const values = value as unknown[];
      const firstValue = values[0];

      if (typeof firstValue === 'string') {
        carrier[key] = firstValue;
        continue;
      }

      if (Buffer.isBuffer(firstValue)) {
        carrier[key] = firstValue.toString('utf8');
      }
    }
  }

  return carrier;
}
