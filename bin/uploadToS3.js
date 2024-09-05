const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

// Configure AWS SDK
AWS.config.update({ region: process.env.AWS_REGION });
const s3 = new AWS.S3();

// Configuration
const S3_BUCKET = process.env.APP_BUCKET;
const BACKUP_DIR = process.env.BACKUP_DIR;

const checkS3BucketExists = async (bucket) => {
  try {
    await s3.headBucket({ Bucket: bucket }).promise();
    return true;
  } catch (error) {
    if (error.code === "NotFound") {
      console.error(`Error: The S3 bucket '${bucket}' does not exist.`);
      return false;
    }
    throw error;
  }
};

const getBackupFiles = (dir) =>
  fs.readdirSync(dir).filter((file) => file.endsWith(".tar.gz"));

const readFileContent = (filePath) => fs.readFileSync(filePath);

const createS3UploadParams = (bucket, file, content) => ({
  Bucket: bucket,
  Key: `backups/${file.split("_")[0]}/${file}`,
  Body: content,
});

const uploadFileToS3 = async (params) => {
  try {
    const result = await s3.upload(params).promise();
    console.log(`File uploaded successfully to ${result.Location}`);
  } catch (uploadError) {
    console.error(`Error uploading file ${params.Key}:`, uploadError);
  }
};

const processFile = async (file) => {
  const filePath = path.join(BACKUP_DIR, file);
  const fileContent = readFileContent(filePath);
  const params = createS3UploadParams(S3_BUCKET, file, fileContent);
  await uploadFileToS3(params);
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
