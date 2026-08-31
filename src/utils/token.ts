import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
}

export const generateAccessToken = (payload: JwtPayload): string => {
    return jwt.sign(payload, config.jwtAccessSecret, {
        expiresIn: config.jwtAccessExpiry as any, // <-- cast to any
    });
};

export const generateRefreshToken = (payload: JwtPayload): string => {
    return jwt.sign(payload, config.jwtRefreshSecret, {
        expiresIn: config.jwtRefreshExpiry as any, // <-- cast to any
    });
};

export const verifyAccessToken = (token: string): JwtPayload => {
    return jwt.verify(token, config.jwtAccessSecret) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
    return jwt.verify(token, config.jwtRefreshSecret) as JwtPayload;
};