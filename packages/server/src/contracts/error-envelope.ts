export interface ErrorDetails {
  [key: string]: unknown;
}

export interface ErrorObject {
  code: string;
  message: string;
  retryable?: boolean;
  details?: ErrorDetails;
}

export interface ErrorEnvelope {
  ok: false;
  error: ErrorObject;
}

export interface SuccessEnvelope<T> {
  ok: true;
  data: T;
}

export type ResultEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;
