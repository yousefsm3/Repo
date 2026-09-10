/**
 * StorageProvider, VectorSearchProvider, PaymentProvider — all swappable.
 */

// ---------- Storage (S3-compatible: AWS S3 or Cloudflare R2) ----------
export interface StorageProvider {
  upload(key: string, buffer: Buffer, contentType: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
  readonly providerName: string;
}

// ---------- Vector Search (pgvector by default) ----------
export interface FaceMatch {
  photoId: string;
  similarity: number; // 0..1, cosine similarity
}

export interface VectorSearchProvider {
  /** Index a face embedding, always scoped to eventId — enforced here, not just in UI. */
  index(params: {
    tenantId: string;
    eventId: string;
    photoId: string;
    faceId: string;
    embedding: number[];
  }): Promise<void>;

  /**
   * Search is ALWAYS scoped to a single eventId.
   * There is intentionally no method that searches across events.
   */
  search(params: {
    eventId: string;
    embedding: number[];
    threshold: number;
    limit?: number;
  }): Promise<FaceMatch[]>;

  deleteByEvent(eventId: string): Promise<void>;
}

// ---------- Payment (Moyasar / HyperPay / Tap / Stripe) ----------
export interface PaymentCharge {
  id: string;
  status: "paid" | "failed" | "pending";
}

export interface PaymentProvider {
  createCharge(params: {
    amountSar: number;
    tenantId: string;
    description: string;
  }): Promise<PaymentCharge>;

  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean;

  readonly providerName: string;
}
