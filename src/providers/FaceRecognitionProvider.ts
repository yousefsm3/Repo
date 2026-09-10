/**
 * FaceRecognitionProvider — abstraction layer.
 * Swap implementations (AWS Rekognition, InsightFace self-hosted, Google Vision)
 * without touching any application/business logic.
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedFace {
  boundingBox: BoundingBox;
  confidence: number;
}

export interface FaceEmbeddingResult {
  boundingBox: BoundingBox;
  embedding: number[]; // fixed-length vector, dimension defined by the provider/model
  confidence: number;
}

export interface FaceRecognitionProvider {
  /** Detects faces in an image buffer, no embedding yet (cheap step). */
  detectFaces(imageBuffer: Buffer): Promise<DetectedFace[]>;

  /** Full pipeline: detect + generate embeddings for every face found. */
  getEmbeddings(imageBuffer: Buffer): Promise<FaceEmbeddingResult[]>;

  /** Embedding dimension this provider returns (e.g. 512 for ArcFace). */
  readonly embeddingDimension: number;

  /** Human-readable provider name, surfaced in Admin > AI Usage. */
  readonly providerName: string;
}

/**
 * Example stub — replace with a real implementation once an API key
 * or self-hosted InsightFace endpoint is available.
 *
 * Recommended options (see docs/COST_ESTIMATE.md for comparison):
 *  - AWS Rekognition (managed, pay-per-image, fastest to integrate)
 *  - Self-hosted InsightFace on a GPU box (cheapest at high volume, more ops work)
 */
export class UnconfiguredFaceRecognitionProvider implements FaceRecognitionProvider {
  readonly embeddingDimension = 512;
  readonly providerName = "unconfigured";

  async detectFaces(): Promise<DetectedFace[]> {
    throw new Error(
      "FaceRecognitionProvider not configured. Set FACE_PROVIDER and its API key in .env " +
      "(see .env.example) before processing photos."
    );
  }

  async getEmbeddings(): Promise<FaceEmbeddingResult[]> {
    throw new Error(
      "FaceRecognitionProvider not configured. Set FACE_PROVIDER and its API key in .env."
    );
  }
}
