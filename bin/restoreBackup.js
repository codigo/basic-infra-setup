const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Configure AWS SDK
AWS.config.update({ region: process.env.AWS_REGION });
const s3 = new AWS.S3();

// Configuration
const S3_BUCKET = process.env.S3_BACKUPS_BUCKET;
const RESTORE_DIR = process.env.RESTORE_DIR || process.env.HOME;

async function getLatestBackup(projectName) {
  const params = {
    Bucket: S3_BUCKET,
    Prefix: `backups/${projectName}/`
  };

  const data = await s3.listObjectsV2(params).promise();
  if (data.Contents.length === 0) {
    throw new Error(`No backups found for project: ${projectName}`);
  }

  // Sort the contents by LastModified date in descending order
  const sortedContents = data.Contents.sort((a, b) => b.LastModified - a.LastModified);

  // Return the key of the most recent backup
  return path.basename(sortedContents[0].Key);
}

async function restoreBackup(projectName, backupFileName) {
  try {
    if (!backupFileName) {
      console.log('No backup file specified. Retrieving the latest backup...');
      backupFileName = await getLatestBackup(projectName);
      console.log(`Latest backup found: ${backupFileName}`);
    }

    // Construct the S3 key
    const s3Key = `backups/${projectName}/${backupFileName}`;

    // Set up S3 download parameters
    const params = {
      Bucket: S3_BUCKET,
      Key: s3Key
    };

    // Download the file from S3
    const data = await s3.getObject(params).promise();

    // Create a temporary directory for the downloaded backup
    const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'backup-'));
    const tempFilePath = path.join(tempDir, backupFileName);

    // Write the file to the temporary directory
    fs.writeFileSync(tempFilePath, data.Body);
    console.log(`Backup downloaded to: ${tempFilePath}`);

    // Create the project directory if it doesn't exist
    const projectPath = path.join(RESTORE_DIR, projectName);
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    // Extract the backup, overwriting existing files
    await execAsync(`tar -xzf "${tempFilePath}" -C "${RESTORE_DIR}" --overwrite`);
    console.log(`Backup restored to: ${projectPath}`);

    // Clean up the temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('Temporary files cleaned up');

    console.log('Restore process completed successfully.');
  } catch (error) {
    console.error('Error during restore process:', error);
  }
}

// Check if projectName is provided as a command line argument
const [, , projectName, backupFileName] = process.argv;

if (!projectName) {
  console.error('Usage: node restoreBackup.js <projectName> [backupFileName]');
  process.exit(1);
}

restoreBackup(projectName, backupFileName);
