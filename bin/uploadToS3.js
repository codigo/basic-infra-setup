const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

// Configure AWS SDK
AWS.config.update({ region: process.env.AWS_REGION });
const s3 = new AWS.S3();

// Configuration
const S3_BUCKET = process.env.S3_BACKUPS_BUCKET;
const BACKUP_DIR = process.env.BACKUP_DIR;

async function uploadToS3() {
  try {
    // Check if the S3 bucket exists
    try {
      await s3.headBucket({ Bucket: S3_BUCKET }).promise();
    } catch (error) {
      if (error.code === "NotFound") {
        console.error(`Error: The S3 bucket '${S3_BUCKET}' does not exist.`);
        return;
      } else {
        throw error;
      }
    }

    const files = fs.readdirSync(BACKUP_DIR);

    for (const file of files) {
      if (file.endsWith(".tar.gz")) {
        const filePath = path.join(BACKUP_DIR, file);
        const fileContent = fs.readFileSync(filePath);

        // Extract folder name from the file name
        const folderName = file.split("_")[0];

        // Set up S3 upload parameters
        const params = {
          Bucket: S3_BUCKET,
          Key: `backups/${folderName}/${file}`, // Use folder structure in S3
          Body: fileContent,
        };

        try {
          // Upload to S3
          const result = await s3.upload(params).promise();
          console.log(`File uploaded successfully to ${result.Location}`);
        } catch (uploadError) {
          console.error(`Error uploading file ${file}:`, uploadError);
        }
      }
    }

    console.log("Upload process completed.");
  } catch (error) {
    console.error("Error during upload process:", error);
  }
}

uploadToS3();
