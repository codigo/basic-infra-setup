const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const os = require("os");

const execAsync = util.promisify(exec);

// Configure AWS SDK v3
const s3 = new S3Client({ region: process.env.AWS_REGION });

// Configuration
const S3_BUCKET = process.env.APP_BUCKET;
const RESTORE_DIR = process.env.RESTORE_DIR || process.env.HOME;

const getLatestBackup = async (projectName) => {
  const data = await s3.send(
    new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: `backups/${projectName}/`,
    }),
  );
  if (!data.Contents || data.Contents.length === 0) {
    throw new Error(`No backups found for project: ${projectName}`);
  }

  return path.basename(
    data.Contents.sort((a, b) => b.LastModified - a.LastModified)[0].Key,
  );
};

const downloadBackup = async (projectName, backupFileName) => {
  const s3Key = `backups/${projectName}/${backupFileName}`;
  const data = await s3.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }),
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "backup-"));
  const tempFilePath = path.join(tempDir, backupFileName);

  // v3 Body has transformToByteArray() for binary content
  const bodyBytes = await data.Body.transformToByteArray();
  fs.writeFileSync(tempFilePath, Buffer.from(bodyBytes));
  console.log(`Backup downloaded to: ${tempFilePath}`);

  return { tempDir, tempFilePath };
};

const extractLocally = async (tempFilePath, projectName) => {
  const projectPath = path.join(RESTORE_DIR, projectName);
  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  await execAsync(
    `tar -xzf "${tempFilePath}" -C "${RESTORE_DIR}" --overwrite`,
  );
  console.log(`Backup extracted to: ${projectPath}`);
};

const restoreDatabases = async (projectName) => {
  if (projectName !== "tooling") return;

  const dumpsDir = path.join(RESTORE_DIR, projectName, "data/infisical/dumps");
  const sqlDump = path.join(dumpsDir, "backup.sql");
  const rdbDump = path.join(dumpsDir, "dump.rdb");

  // Restore Postgres
  if (fs.existsSync(sqlDump)) {
    try {
      const { stdout: dbContainer } = await execAsync(
        `docker ps -q -f name=tooling_infisical-db`,
      );
      if (!dbContainer.trim()) {
        console.warn(
          "Infisical DB container not running. Start the tooling stack first, then re-run restore.",
        );
      } else {
        // Drop and recreate to ensure clean restore
        await execAsync(
          `docker exec ${dbContainer.trim()} psql -U infisical -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`,
        );
        await execAsync(
          `docker exec -i ${dbContainer.trim()} psql -U infisical infisical < "${sqlDump}"`,
        );
        console.log("Infisical Postgres restored successfully");
      }
    } catch (e) {
      console.error("Failed to restore Infisical Postgres:", e.message);
    }
  } else {
    console.warn("No Postgres dump found at:", sqlDump);
  }

  // Restore Redis
  if (fs.existsSync(rdbDump)) {
    try {
      const { stdout: redisContainer } = await execAsync(
        `docker ps -q -f name=tooling_infisical-redis`,
      );
      if (!redisContainer.trim()) {
        console.warn(
          "Infisical Redis container not running. Start the tooling stack first, then re-run restore.",
        );
      } else {
        await execAsync(
          `docker cp "${rdbDump}" ${redisContainer.trim()}:/data/dump.rdb`,
        );
        // Restart Redis to load the dump
        await execAsync(
          `docker service update --force tooling_infisical-redis`,
        );
        console.log("Infisical Redis restored successfully");
      }
    } catch (e) {
      console.error("Failed to restore Infisical Redis:", e.message);
    }
  } else {
    console.warn("No Redis dump found at:", rdbDump);
  }
};

const restoreServices = async (projectName) => {
  try {
    const { stdout } = await execAsync(
      `docker stack ls --format "{{.Name}}"`,
    );
    const stacks = stdout.trim().split("\n");

    if (projectName === "tooling" && stacks.includes("tooling")) {
      await restoreDatabases(projectName);
      await execAsync(`docker service update --force tooling_infisical`);
      console.log("Infisical service restarted");
    } else if (stacks.includes(projectName)) {
      const composeFile = path.join(
        RESTORE_DIR,
        `docker-compose.${projectName}.yaml`,
      );
      if (fs.existsSync(composeFile)) {
        await execAsync(
          `docker stack deploy -c "${composeFile}" ${projectName}`,
        );
        console.log(`${projectName} stack redeployed with restored data`);
      } else {
        console.log(
          `${projectName} files restored. Redeploy the stack manually to pick up changes.`,
        );
      }
    } else {
      console.log(
        `${projectName} files restored. No running stack found — deploy when ready.`,
      );
    }
  } catch (e) {
    console.error("Failed to restore services:", e.message);
  }
};

const restoreBackup = async (projectName, backupFileName) => {
  try {
    const finalBackupFileName =
      backupFileName || (await getLatestBackup(projectName));
    if (!backupFileName) {
      console.log(`Latest backup found: ${finalBackupFileName}`);
    }

    const { tempDir, tempFilePath } = await downloadBackup(
      projectName,
      finalBackupFileName,
    );

    await extractLocally(tempFilePath, projectName);
    await restoreServices(projectName);

    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log("Temporary files cleaned up");

    console.log("Restore process completed successfully.");
  } catch (error) {
    console.error("Error during restore process:", error);
  }
};

const [, , projectName, backupFileName] = process.argv;

if (!projectName) {
  console.error(
    "Usage: node restoreBackup.js <projectName> [backupFileName]",
  );
  process.exit(1);
}

restoreBackup(projectName, backupFileName);
