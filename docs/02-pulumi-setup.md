# Understanding the Mau App Infrastructure Project: Part 2 - Pulumi Setup

In this part, we'll dive into setting up Pulumi, the Infrastructure as Code (IaC) tool used in the Mau App Infrastructure project. Pulumi allows us to define our infrastructure using familiar programming languages, in this case, TypeScript.

## What is Pulumi?

Pulumi is an open-source infrastructure as code tool that allows you to define and manage cloud resources using programming languages you're already familiar with. Instead of learning a domain-specific language like HCL (HashiCorp Configuration Language), you can use TypeScript, Python, Go, or other supported languages.

## Why Pulumi?

1. **Familiar Language**: Using TypeScript allows us to leverage existing programming skills.
2. **Type Safety**: TypeScript provides strong typing, reducing errors in our infrastructure code.
3. **Modularity**: We can use programming constructs like functions and classes to create reusable infrastructure components.
4. **Rich Ecosystem**: Pulumi has extensive support for various cloud providers and services.

## Setting Up Pulumi

Let's walk through the basic setup of Pulumi in our project:

1. **Installation**: First, you need to install Pulumi. You can find installation instructions for your operating system on the [Pulumi website](https://www.pulumi.com/docs/get-started/install/).

2. **Project Initialization**: In our project, we've already initialized Pulumi. You can see the configuration in the `Pulumi.yaml` file:

   ```yaml
   name: mau-app
   runtime:
     name: nodejs
     options:
       packagemanager: npm
       typescript: true
   description: My portfolio and blog with an introduction of myself and a contact form
   ```

   This configuration tells Pulumi that we're using Node.js with TypeScript for our infrastructure code.

3. **Main Program**: The main Pulumi program is defined in `index.ts`. This file orchestrates the creation and configuration of all our infrastructure resources.

4. **Configuration**: Sensitive configuration values are stored securely using Pulumi's configuration system. You can see how these are accessed in the code:

   ```typescript
   const config = new pulumi.Config();
   const awsAccessKeyId = config.requireSecret("awsAccessKeyId");
   ```

## Key Components in Our Pulumi Setup

1. **Resource Creation**: We define various cloud resources using Pulumi's SDKs. For example:

   ```typescript
   const s3Resources = createS3Bucket();
   const iamResources = createIAMResources();
   ```

2. **Dependency Management**: Pulumi automatically manages dependencies between resources. We also explicitly define some dependencies:

   ```typescript
   const serverConfig = initialSetup.apply((resources) => {
     // ... configuration logic
   });
   ```

3. **Output Management**: We export important values from our Pulumi program:

   ```typescript
   export const serverIp = initialSetup.apply(
     (resources) => resources.server.ipv4Address
   );
   ```

## Next Steps

In the next part, we'll explore how we use Pulumi to set up our cloud providers, starting with AWS for storage and Hetzner for compute resources. We'll dive into the specific resources we're creating and how they fit into our overall infrastructure.

Remember, Pulumi is a powerful tool that allows us to treat our infrastructure as code, providing version control, modularity, and programmatic access to cloud resources. As we progress through this series, you'll see how this approach simplifies managing complex infrastructure setups.
