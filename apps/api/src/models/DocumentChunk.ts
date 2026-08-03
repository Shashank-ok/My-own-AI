import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export interface IDocumentChunk extends MongooseDocument {
  ownerId: Types.ObjectId;
  documentId: Types.ObjectId;
  chunkIndex: number;
  text: string;
  embedding: number[];
  embeddingModel: string;
  embeddingDimensions: number;
  engineVectorId: string;
  engineNamespace: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const documentChunkSchema = new Schema<IDocumentChunk>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Document ID is required'],
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: [true, 'Chunk index is required'],
      min: 0,
    },
    text: {
      type: String,
      required: [true, 'Chunk text content is required'],
    },
    embedding: {
      type: [Number],
      required: [true, 'Embedding vector is required'],
      validate: {
        validator: function (this: IDocumentChunk, val: number[]) {
          return Array.isArray(val) && val.length === this.embeddingDimensions;
        },
        message: 'Embedding length must match embeddingDimensions',
      },
    },
    embeddingModel: {
      type: String,
      required: [true, 'Embedding model name is required'],
      trim: true,
    },
    embeddingDimensions: {
      type: Number,
      required: [true, 'Embedding dimensions count is required'],
      min: 1,
    },
    engineVectorId: {
      type: String,
      required: [true, 'Engine vector ID is required'],
      index: true,
      trim: true,
    },
    engineNamespace: {
      type: String,
      required: [true, 'Engine namespace is required'],
      index: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// Unique compound index enforcing one chunk per chunkIndex per document
documentChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });
documentChunkSchema.index({ engineNamespace: 1, engineVectorId: 1 });

export const DocumentChunk = model<IDocumentChunk>('DocumentChunk', documentChunkSchema);
