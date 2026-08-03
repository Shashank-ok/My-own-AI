import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface IDocument extends MongooseDocument {
  ownerId: Types.ObjectId;
  title: string;
  status: DocumentStatus;
  chunkCount: number;
  originalFileName?: string;
  mimeType?: string;
  metadata: Record<string, unknown>;
  ingestionError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      required: true,
      index: true,
    },
    chunkCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalFileName: {
      type: String,
      trim: true,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ingestionError: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

documentSchema.index({ ownerId: 1, createdAt: -1 });

export const DocumentModel = model<IDocument>('Document', documentSchema);
