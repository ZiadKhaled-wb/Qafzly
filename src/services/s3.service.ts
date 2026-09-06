import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env';

const s3Client = new S3Client({
    region: config.awsRegion,
    credentials: {
        accessKeyId: config.awsAccessKeyId!,
        secretAccessKey: config.awsSecretAccessKey!,
    },
});

export const uploadPdfToS3 = async (key: string, fileBuffer: Buffer, contentType = 'application/pdf') => {
    const command = new PutObjectCommand({
        Bucket: config.s3BucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
    });
    await s3Client.send(command);
    return key;
};

export const deletePdfFromS3 = async (key: string) => {
    const command = new DeleteObjectCommand({
        Bucket: config.s3BucketName,
        Key: key,
    });
    await s3Client.send(command);
};

export const getSignedPdfUrl = async (key: string, expiresInSeconds = 300): Promise<string> => {
    const command = new GetObjectCommand({
        Bucket: config.s3BucketName,
        Key: key,
    });
    return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};