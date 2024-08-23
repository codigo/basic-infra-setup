const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");

const execAsync = util.promisify(exec);

const BASE_DIR = process.env.HOME;
const BACKUP_DIR = process.env.BACKUP_DIR;

async function createBackups() {
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Find all directories that contain a 'data' subdirectory
    const dirsToBackup = [];
    const allDirs = fs
      .readdirSync(BASE_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const dir of allDirs) {
      const fullPath = path.join(BASE_DIR, dir);
      if (fs.existsSync(path.join(fullPath, "data"))) {
        dirsToBackup.push(dir);
      }
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:T]/g, "-")
      .split(".")[0];

    for (const dir of dirsToBackup) {
      const sourcePath = path.join(BASE_DIR, dir);
      const backupFileName = `${dir}_${timestamp}.tar.gz`;
      const backupPath = path.join(BACKUP_DIR, backupFileName);

      // Create compressed backup
      await execAsync(`tar -czf "${backupPath}" -C "${BASE_DIR}" "${dir}"`);
      console.log(`Backup created: ${backupPath}`);
    }

    // Remove backups older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const files = fs.readdirSync(BACKUP_DIR);

    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      if (stats.mtime < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old backup: ${filePath}`);
      }
    }

    console.log("Backup process completed successfully.");
  } catch (error) {
    console.error("Error during backup process:", error);
  }
}

createBackups();
