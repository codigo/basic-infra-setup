# Backup System

This backup system is designed to create compressed backups of specific directories, upload them to an S3 bucket, and restore them when needed. It consists of three main scripts: `backupData.js`, `uploadToS3.js`, and `restoreBackup.js`.

## How it works

1. The `backupData.js` script searches for directories in the user's home folder that contain a `data` subdirectory.
2. It creates a compressed tar.gz backup of each matching directory, preserving the entire directory structure.
3. The backups are stored in a specified backup directory.
4. Old backups (older than 7 days) are automatically removed.
5. The `uploadToS3.js` script then uploads these backup files to an S3 bucket, organizing them into folders based on the original directory names.
6. The `restoreBackup.js` script allows you to retrieve a specific backup (or the latest backup) from S3 and restore it to a project directory, overwriting existing files if necessary.

## Configuration

The scripts use environment variables for configuration:

- `HOME`: The base directory to search for folders (usually the user's home directory)
- `BACKUP_DIR`: The directory where backups will be stored
- `AWS_REGION`: The AWS region for S3 (e.g., 'us-west-2')
- `S3_BACKUPS_BUCKET`: The name of the S3 bucket for storing backups
- `RESTORE_DIR`: (Optional) The directory where backups will be restored (defaults to HOME if not set)

## Example

Let's say you have the following directory structure in your home folder:

```
~/
├── project1/
│   ├── data/
│   │   └── important_files/
│   └── other_stuff/
├── project2/
│   ├── data/
│   │   └── more_important_files/
│   └── misc/
└── random_folder/
    └── unimportant_stuff/
```

1. The `backupData.js` script will identify `project1` and `project2` as directories to backup because they contain a `data` subdirectory.

2. It will create backup files in the `BACKUP_DIR`:
   ```
   BACKUP_DIR/
   ├── project1_2024-08-19-12-00-00.tar.gz
   └── project2_2024-08-19-12-00-00.tar.gz
   ```

3. Each tar.gz file will contain the entire directory structure of the respective project.

4. The `uploadToS3.js` script will then upload these files to the S3 bucket with the following structure:
   ```
   S3_BACKUPS_BUCKET/
   ├── backups/
   │   ├── project1/
   │   │   └── project1_2024-08-19-12-00-00.tar.gz
   │   └── project2/
   │       └── project2_2024-08-19-12-00-00.tar.gz
   ```

5. To restore a backup, you would use the `restoreBackup.js` script, specifying the project name and optionally the backup file name. For example:
   ```
   node restoreBackup.js project1 project1_2024-08-19-12-00-00.tar.gz
   ```
   This would download the specified backup from S3 and restore it to the `RESTORE_DIR` (or `HOME` if `RESTORE_DIR` is not set), overwriting any existing files.

   If you don't specify a backup file name, the script will automatically retrieve the latest backup:
   ```
   node restoreBackup.js project1
   ```

## Usage

1. Set up the required environment variables.
2. Run `node backupData.js` to create the backups.
3. Run `node uploadToS3.js` to upload the backups to S3.
4. To restore a backup:
   - Run `node restoreBackup.js <projectName> [backupFileName]` to restore a specific backup.
   - Run `node restoreBackup.js <projectName>` to restore the latest backup for the project.

You can automate the backup and upload process by setting up a cron job or a scheduled task to run these scripts periodically.

## Restore Process

The restore process works as follows:

1. If no specific backup file is specified, the script retrieves the latest backup for the given project from S3.
2. The script downloads the specified (or latest) backup file from S3 to a temporary directory.
3. It then extracts the contents of the backup to the specified restore directory (or home directory if not specified), overwriting any existing files.
4. After the restore is complete, the temporary files are cleaned up.

Note: Be cautious when restoring backups, as it will overwrite existing files in the project directory. It's recommended to review the contents of the backup before restoring, especially in production environments.
