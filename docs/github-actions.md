# GitHub Actions in This Project

In this project, GitHub Actions is used to automate two main workflows: deploying infrastructure and generating documentation. Let's break down each workflow and understand how they are configured and leveraged.

## 1. Deploy Infrastructure Workflow

**File:** `.github/workflows/deploy-infrastructure.yaml`

**Purpose:** This workflow is triggered by a `repository_dispatch` event with the type `deploy-application`. It is designed to deploy the application infrastructure using Pulumi, a modern infrastructure as code platform.

**Key Components:**

- **Environment Variables:** Secrets and variables are set up to provide necessary credentials and configuration values. These include access tokens, API keys, and other sensitive information stored securely in GitHub Secrets.

- **Jobs:**
  - **Checkout Code:** Uses the `actions/checkout@v4` action to clone the repository code into the runner.
  - **Setup Node.js:** Configures the Node.js environment using `actions/setup-node@v4` with a specified version.
  - **Install Dependencies:** Runs `npm ci` to install Node.js dependencies.
  - **Process Configuration Files:** Uses a shell script to replace placeholders in configuration files with actual values from secrets and variables.
  - **Setup SSH Keys:** Configures SSH keys for secure access, ensuring the keys have the correct permissions.
  - **Setup Pulumi:** Uses `pulumi/actions@v5` to set up Pulumi for infrastructure deployment.
  - **Configure Pulumi:** A series of `pulumi config set` commands are used to configure the Pulumi stack with necessary settings and secrets.
  - **Deploy Infrastructure:** Executes the Pulumi `up` command to deploy the infrastructure, using the configured stack.

**Security Considerations:** The workflow uses GitHub Secrets to manage sensitive information securely. It also includes debug steps to verify configurations without exposing secrets.

## 2. Generate Docs Workflow

**File:** `.github/workflows/generate-docs.yaml`

**Purpose:** This workflow is triggered on a push to the `main` branch. It is responsible for generating and releasing documentation using Semantic Release, a tool for automating versioning and package publishing.

**Key Components:**

- **Permissions:** The job requires write permissions for contents, pull requests, and issues to manage releases and update documentation.

- **Jobs:**

  - **Semantic Release:** This job uses the `cycjimmy/semantic-release-action@v4` to automate the release process. It includes several plugins for analyzing commits, generating release notes, updating changelogs, publishing to npm, and committing changes back to the repository.

- **Environment Variables:** The `GITHUB_TOKEN` is used to authenticate the action with GitHub, allowing it to perform operations like creating releases and updating files.

**Automation Benefits:**

- **Consistency:** Ensures that infrastructure deployments and documentation releases are consistent and repeatable.
- **Efficiency:** Reduces manual intervention, allowing developers to focus on coding rather than deployment and release processes.
- **Security:** Manages sensitive information securely using GitHub Secrets, minimizing the risk of exposure.

Overall, these workflows leverage GitHub Actions to streamline and automate critical processes in the project, enhancing both productivity and security.
