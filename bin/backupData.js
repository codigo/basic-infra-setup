const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");

const execAsync = util.promisify(exec);

const BASE_DIR = process.env.HOME;
const BACKUP_DIR = process.env.BACKUP_DIR;

const ensureBackupDirectoryExists = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
};

const findDirsWithDataSubdir = () => {
  const allDirs = fs
    .readdirSync(BASE_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  return allDirs.filter((dir) =>
    fs.existsSync(path.join(BASE_DIR, dir, "data")),
  );
};

const generateTimestamp = () =>
  new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];

const dumpDatabases = async (dir) => {
  if (dir !== "tooling") return;

  // Dump Infisical Postgres
  try {
    const dumpDir = path.join(BASE_DIR, dir, "data/infisical/postgres");
    if (fs.existsSync(dumpDir)) {
      const dumpPath = path.join(dumpDir, "backup.sql");
      await execAsync(
        `docker exec $(docker ps -q -f name=tooling_infisical-db) pg_dump -U infisical infisical > "${dumpPath}"`,
      );
      console.log("Infisical DB dumped successfully");
    }
  } catch (e) {
    console.error("Failed to dump Infisical DB:", e.message);
  }

  // Dump Redis
  try {
    const redisDir = path.join(BASE_DIR, dir, "data/infisical/redis");
    if (fs.existsSync(redisDir)) {
      await execAsync(
        `docker exec $(docker ps -q -f name=tooling_infisical-redis) redis-cli BGSAVE`,
      );
      await execAsync(
        `docker cp $(docker ps -q -f name=tooling_infisical-redis):/data/dump.rdb "${path.join(redisDir, "dump.rdb")}"`,
      );
      console.log("Redis data copied successfully");
    }
  } catch (e) {
    console.error("Failed to dump Redis:", e.message);
  }
};

const createBackup = async (dir, timestamp) => {
  await dumpDatabases(dir);
  const backupFileName = `${dir}_${timestamp}.tar.gz`;
  const backupPath = path.join(BACKUP_DIR, backupFileName);
  await execAsync(`tar -czf "${backupPath}" -C "${BASE_DIR}" "${dir}"`);
  console.log(`Backup created: ${backupPath}`);
};

const removeOldBackups = () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  fs.readdirSync(BACKUP_DIR)
    .map((file) => path.join(BACKUP_DIR, file))
    .filter((filePath) => fs.statSync(filePath).mtime < sevenDaysAgo)
    .forEach((filePath) => {
      fs.unlinkSync(filePath);
      console.log(`Deleted old backup: ${filePath}`);
    });
};

const createBackups = async () => {
  try {
    ensureBackupDirectoryExists();
    const dirsToBackup = findDirsWithDataSubdir();
    const timestamp = generateTimestamp();

    await Promise.all(dirsToBackup.map((dir) => createBackup(dir, timestamp)));

    removeOldBackups();

    console.log("Backup process completed successfully.");
  } catch (error) {
    console.error("Error during backup process:", error);
  }
};

createBackups();
