const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const r2 = new S3Client({
  region: 'auto',
  endpoint: 'https://test.r2.cloudflarestorage.com',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

async function test() {
  const command = new PutObjectCommand({
    Bucket: 'test',
    Key: 'test.png',
    ContentType: 'image/png'
  });
  const url = await getSignedUrl(r2, command, { expiresIn: 300 });
  console.log(url);
}
test();
