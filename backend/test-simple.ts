import * as dotenv from 'dotenv';
dotenv.config();
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function run() {
  try {
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: 'test-plain.txt',
      Body: 'hello',
      ContentType: 'text/plain',
    }));
    console.log('SUCCESS');
  } catch (e) {
    console.log('ERROR:', e);
  }
}
run();
