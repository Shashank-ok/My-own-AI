import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { config } from '../config/env';
import { RegisterInput, LoginInput } from '../schemas/auth.schema';

export interface SanitizedUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export function sanitizeUser(user: IUser): SanitizedUser {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function generateToken(user: IUser): string {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: '7d' },
  );
}

export async function registerUser(input: RegisterInput) {
  const existingUser = await User.findOne({ email: input.email.toLowerCase() });
  if (existingUser) {
    const err = new Error('User with this email already exists') as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(input.password, saltRounds);

  const user = new User({
    email: input.email.toLowerCase(),
    passwordHash,
    name: input.name,
  });

  await user.save();

  const token = generateToken(user);
  return {
    user: sanitizeUser(user),
    token,
  };
}

export async function loginUser(input: LoginInput) {
  const user = await User.findOne({ email: input.email.toLowerCase() });
  if (!user) {
    const err = new Error('Invalid email or password') as Error & { statusCode?: number };
    err.statusCode = 401;
    throw err;
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    const err = new Error('Invalid email or password') as Error & { statusCode?: number };
    err.statusCode = 401;
    throw err;
  }

  const token = generateToken(user);
  return {
    user: sanitizeUser(user),
    token,
  };
}

export async function getUserProfile(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  return sanitizeUser(user);
}
