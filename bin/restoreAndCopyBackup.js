const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const readline = require("readline");

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
    Prefix: `backups/${projectName}/`,
  };

  const data = await s3.listObjectsV2(params).promise();
  if (data.Contents.length === 0) {
    throw new Error(`No backups found for project: ${projectName}`);
  }

  const sortedContents = data.Contents.sort(
    (a, b) => b.LastModified - a.LastModified,
  );

  return path.basename(sortedContents[0].Key);
}

async function downloadBackup(projectName, backupFileName) {
  const s3Key = `backups/${projectName}/${backupFileName}`;
  const params = {
    Bucket: S3_BUCKET,
    Key: s3Key,
  };

  const data = await s3.getObject(params).promise();
  const tempDir = fs.mkdtempSync(
    path.join(require("os").tmpdir(), "backup-"),
  );
  const tempFilePath = path.join(tempDir, backupFileName);

  fs.writeFileSync(tempFilePath, data.Body);
  console.log(`Backup downloaded to: ${tempFilePath}`);

  return { tempDir, tempFilePath };
}

async function extractLocally(tempFilePath, projectName) {
  const projectPath = path.join(RESTORE_DIR, projectName);
  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  await execAsync(
    `tar -xzf "${tempFilePath}" -C "${RESTORE_DIR}" --overwrite`,
  );
  console.log(`Backup extracted to: ${projectPath}`);
}

async function copyToRemote(sourceFile, destinationFolder, remoteHost, sshKeyFile) {
  let scpCommand = `scp`;
  
  if (sshKeyFile) {
    scpCommand += ` -i "${sshKeyFile}"`;
  }
  
  scpCommand += ` "${sourceFile}" ${remoteHost}:"${destinationFolder}"`;

  console.log(`Copying file: ${path.basename(sourceFile)} to ${remoteHost}:${destinationFolder}`);

  const { stdout, stderr } = await execAsync(scpCommand);

  if (stderr) {
    console.error("Error during file copy:", stderr);
    return;
  }

  console.log("File copied successfully!");
  if (stdout) {
    console.log(stdout);
  }
}

async function extractRemotely(remoteHost, remoteFilePath, remoteDestination, sshKeyFile) {
  let sshCommand = `ssh`;
  
  if (sshKeyFile) {
    sshCommand += ` -i "${sshKeyFile}"`;
  }
  
  sshCommand += ` ${remoteHost} "mkdir -p ${remoteDestination} && tar -xzf ${remoteFilePath} -C ${remoteDestination} --overwrite"`;

  console.log(`Extracting backup on remote host: ${remoteHost}`);

  const { stdout, stderr } = await execAsync(sshCommand);

  if (stderr) {
    console.error("Error during remote extraction:", stderr);
    return;
  }

  console.log("Backup extracted successfully on remote host!");
  if (stdout) {
    console.log(stdout);
  }
}

async function getUserInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function restoreAndCopyBackup(projectName, backupFileName) {
  try {
    if (!backupFileName) {
      console.log("No backup file specified. Retrieving the latest backup...");
      backupFileName = await getLatestBackup(projectName);
      console.log(`Latest backup found: ${backupFileName}`);
    }

    const { tempDir, tempFilePath } = await downloadBackup(projectName, backupFileName);

    const destinationType = await getUserInput("Enter destination type (local/remote): ");

    if (destinationType.toLowerCase() === "local") {
      await extractLocally(tempFilePath, projectName);
    } else if (destinationType.toLowerCase() === "remote") {
      const remoteHost = await getUserInput("Enter remote host (e.g., user@example.com): ");
      const remoteDestination = await getUserInput("Enter remote destination folder: ");
      const sshKeyFile = await getUserInput("Enter SSH key file path (optional, press Enter to skip): ");

      await copyToRemote(tempFilePath, remoteDestination, remoteHost, sshKeyFile || null);
      await extractRemotely(remoteHost, path.join(remoteDestination, backupFileName), remoteDestination, sshKeyFile || null);
    } else {
      console.error("Invalid destination type. Please choose 'local' or 'remote'.");
    }

    // Clean up the temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log("Temporary files cleaned up");

    console.log("Restore and copy process completed successfully.");
  } catch (error) {
    console.error("Error during restore and copy process:", error);
  }
}

// Check if projectName is provided as a command line argument
const [, , projectName, backupFileName] = process.argv;

if (!projectName) {
  console.error("Usage: node restoreAndCopyBackup.js <projectName> [backupFileName]");
  process.exit(1);
}

restoreAndCopyBackup(projectName, backupFileName);