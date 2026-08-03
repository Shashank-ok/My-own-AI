import { Schema, model, Document as MongooseDocument, Types } from 'mongoose';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface IMessage {
  _id?: Types.ObjectId;
  role: MessageRole;
  content: string;
  sourceChunkIds: Types.ObjectId[];
  model?: string;
  createdAt: Date;
}

export interface IConversation extends MongooseDocument {
  ownerId: Types.ObjectId;
  title: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: [true, 'Message role is required'],
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
    },
    sourceChunkIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'DocumentChunk' }],
      default: [],
    },
    model: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const conversationSchema = new Schema<IConversation>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Conversation title is required'],
      trim: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

conversationSchema.index({ ownerId: 1, updatedAt: -1 });

export const Conversation = model<IConversation>('Conversation', conversationSchema);
