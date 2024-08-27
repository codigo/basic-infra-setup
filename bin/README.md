# Backup System

This backup system is designed to create compressed backups of specific directories, upload them to an S3 bucket, and restore them when needed. It consists of three main scripts: `backupData.js`, `uploadToS3.js`, and `restoreAndCopyBackup.js`.

## Scripts

### backupData.js

This script is responsible for creating compressed backups of specific directories. It:

- Searches for directories in the user's home folder that contain a `data` subdirectory.
- Creates a compressed tar.gz backup of each matching directory, preserving the entire directory structure.
- Stores the backups in a specified backup directory.
- Automatically removes old backups (older than 7 days).

### uploadToS3.js

This script handles the uploading of backup files to an S3 bucket. It:

- Uploads the backup files created by `backupData.js` to the specified S3 bucket.
- Organizes the backups in the S3 bucket into folders based on the original directory names.

### restoreAndCopyBackup.js

This script combines the functionality of the previous `restoreBackup.js` and `copyFileToRemote.js` scripts. It allows for the restoration of backups from S3 to either a local directory or a remote host. It:

- Retrieves a specific backup (or the latest backup) from S3 for a given project.
- Allows the user to choose between restoring to a local directory or a remote host.
- For local restoration:
  - Restores the backup to a project directory, overwriting existing files if necessary.
- For remote restoration:
  - Copies the backup file to the specified remote host.
  - Extracts the backup on the remote host.
- Can be used to restore either a specific backup file or the latest available backup for a project.

## How it works

1. The `backupData.js` script searches for directories in the user's home folder that contain a `data` subdirectory.
2. It creates a compressed tar.gz backup of each matching directory, preserving the entire directory structure.
3. The backups are stored in a specified backup directory.
4. Old backups (older than 7 days) are automatically removed.
5. The `uploadToS3.js` script then uploads these backup files to an S3 bucket, organizing them into folders based on the original directory names.
6. The `restoreAndCopyBackup.js` script allows you to retrieve a specific backup (or the latest backup) from S3 and restore it to either a local project directory or a remote host, overwriting existing files if necessary.

## Configuration

The scripts use environment variables for configuration:

- `HOME`: The base directory to search for folders (usually the user's home directory)
- `BACKUP_DIR`: The directory where backups will be stored
- `AWS_REGION`: The AWS region for S3 (e.g., 'us-west-2')
- `S3_BACKUPS_BUCKET`: The name of the S3 bucket for storing backups
- `RESTORE_DIR`: (Optional) The directory where backups will be restored locally (defaults to HOME if not set)

## Example with Folder Structure

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

5. To restore a backup, you would use the `restoreAndCopyBackup.js` script. For example:

   ```
   node restoreAndCopyBackup.js project1
   ```

   This would download the latest backup for project1 from S3 and prompt you to choose between local or remote restoration. If you choose local, it would restore to the `RESTORE_DIR` (or `HOME` if `RESTORE_DIR` is not set), overwriting any existing files.

   If you want to restore to a remote host, the script will guide you through providing the necessary information for the remote connection and destination.

## Usage

1. Set up the required environment variables.
2. Run `node backupData.js` to create the backups.
3. Run `node uploadToS3.js` to upload the backups to S3.
4. To restore a backup or copy it to a remote host:
   - Run `node restoreAndCopyBackup.js <projectName> [backupFileName]`

You can automate the backup and upload process by setting up a cron job or a scheduled task to run these scripts periodically.

## Restore and Copy Process

The restore and copy process works as follows:

1. If no specific backup file is specified, the script retrieves the latest backup for the given project from S3.
2. The script downloads the specified (or latest) backup file from S3 to a temporary directory.
3. The user is prompted to choose between a local or remote destination.
4. For local restoration:
   - It extracts the contents of the backup to the specified restore directory (or home directory if not specified), overwriting any existing files.
5. For remote restoration:
   - The user is prompted for the remote host information and SSH key file (optional).
   - The backup file is copied to the specified remote host.
   - The backup is extracted on the remote host.
6. After the restore is complete, the temporary files are cleaned up.

Note: Be cautious when restoring backups, as it will overwrite existing files in the project directory. It's recommended to review the contents of the backup before restoring, especially in production environments.

## Examples of Usage

### Restore the latest backup of a project locally:

```
node restoreAndCopyBackup.js project1
```

This command will:

1. Retrieve the latest backup for project1 from S3.
2. Prompt the user to choose between local or remote destination.
3. If local is chosen, extract the backup to the local restore directory.

### Restore a specific backup of a project to a remote host:

```
node restoreAndCopyBackup.js project2 project2_2024-08-19-12-00-00.tar.gz
```

This command will:

1. Retrieve the specified backup for project2 from S3.
2. Prompt the user to choose between local or remote destination.
3. If remote is chosen:
   - Prompt for the remote host information (e.g., user@example.com).
   - Prompt for the remote destination folder.
   - Optionally prompt for an SSH key file.
   - Copy the backup to the remote host.
   - Extract the backup on the remote host.

### Restore the latest backup of a project to a remote host:

```
node restoreAndCopyBackup.js project3
```

This command will:

1. Retrieve the latest backup for project3 from S3.
2. Prompt the user to choose between local or remote destination.
3. If remote is chosen, follow the same steps as in the previous example for remote restoration.

Note: The script will guide you through the process with interactive prompts, making it easy to specify the desired destination and provide necessary information for remote operations.
