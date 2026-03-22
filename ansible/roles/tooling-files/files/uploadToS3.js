const {
  S3Client,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

// Configure AWS SDK v3
const s3 = new S3Client({ region: process.env.AWS_REGION });

// Configuration
const S3_BUCKET = process.env.APP_BUCKET;
const BACKUP_DIR = process.env.BACKUP_DIR;

const checkS3BucketExists = async (bucket) => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (error) {
    if (error.name === "NotFound") {
      console.error(`Error: The S3 bucket '${bucket}' does not exist.`);
      return false;
    }
    throw error;
  }
};

const getBackupFiles = (dir) =>
  fs.readdirSync(dir).filter((file) => file.endsWith(".tar.gz"));

const fileExistsInS3 = async (bucket, key) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
};

const processFile = async (file) => {
  const s3Key = `backups/${file.split("_")[0]}/${file}`;
  if (await fileExistsInS3(S3_BUCKET, s3Key)) {
    console.log(`Skipping ${file} (already in S3)`);
    return;
  }
  const filePath = path.join(BACKUP_DIR, file);
  const fileContent = fs.readFileSync(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
    }),
  );
  console.log(
    `File uploaded successfully to https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`,
  );
};

const uploadToS3 = async () => {
  try {
    if (!(await checkS3BucketExists(S3_BUCKET))) return;

    const files = getBackupFiles(BACKUP_DIR);
    await Promise.all(files.map(processFile));

    console.log("Upload process completed.");
  } catch (error) {
    console.error("Error during upload process:", error);
  }
};

uploadToS3();
