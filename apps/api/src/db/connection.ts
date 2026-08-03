import mongoose from 'mongoose';
import { config } from '../config/env';

export async function connectDatabase(uri: string = config.mongoUri): Promise<typeof mongoose> {
  try {
    mongoose.connection.on('connected', () => {
      console.log('🍃 MongoDB connection established');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB connection disconnected');
    });

    const conn = await mongoose.connect(uri);
    return conn;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
