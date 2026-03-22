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

  const dumpsDir = path.join(BASE_DIR, dir, "data/infisical/dumps");
  fs.mkdirSync(dumpsDir, { recursive: true });

  // Dump Infisical Postgres
  try {
    const dumpPath = path.join(dumpsDir, "backup.sql");
    await execAsync(
      `docker exec $(docker ps -q -f name=tooling_infisical-db) pg_dump -U infisical infisical > "${dumpPath}"`,
    );
    console.log("Infisical DB dumped successfully");
  } catch (e) {
    console.error("Failed to dump Infisical DB:", e.message);
  }

  // Dump Redis
  try {
    await execAsync(
      `docker exec $(docker ps -q -f name=tooling_infisical-redis) redis-cli BGSAVE`,
    );
    const rdbPath = path.join(dumpsDir, "dump.rdb");
    await execAsync(
      `docker cp $(docker ps -q -f name=tooling_infisical-redis):/data/dump.rdb "${rdbPath}"`,
    );
    console.log("Redis data copied successfully");
  } catch (e) {
    console.error("Failed to dump Redis:", e.message);
  }
};

// Directories owned by Docker container UIDs that codigo can't read.
// We back up their data via docker exec dumps instead.
const TAR_EXCLUDES = [
  "tooling/data/caddy/data",
  "tooling/data/caddy/config",
  "tooling/data/infisical/postgres",
  "tooling/data/infisical/redis",
];

const createBackup = async (dir, timestamp) => {
  await dumpDatabases(dir);
  const backupFileName = `${dir}_${timestamp}.tar.gz`;
  const backupPath = path.join(BACKUP_DIR, backupFileName);
  const excludes = TAR_EXCLUDES.map((e) => `--exclude="${e}"`).join(" ");
  await execAsync(
    `tar ${excludes} -czf "${backupPath}" -C "${BASE_DIR}" "${dir}"`,
  );
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

    for (const dir of dirsToBackup) {
      try {
        await createBackup(dir, timestamp);
      } catch (e) {
        console.error(`Failed to backup ${dir}:`, e.message);
      }
    }

    removeOldBackups();

    console.log("Backup process completed successfully.");
  } catch (error) {
    console.error("Error during backup process:", error);
  }
};

createBackups();
