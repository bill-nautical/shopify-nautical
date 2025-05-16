// CI/CD deployment script
require("dotenv").config();
const { PrismaticClient } = require("@prismatic-io/client");

async function deployIntegration() {
  // Check for required environment variables
  if (
    !process.env.PRISMATIC_CLIENT_ID ||
    !process.env.PRISMATIC_CLIENT_SECRET
  ) {
    console.error(
      "Error: PRISMATIC_CLIENT_ID and PRISMATIC_CLIENT_SECRET environment variables must be set"
    );
    console.error(
      "You can set these in a .env file or as environment variables"
    );
    process.exit(1);
  }

  const client = new PrismaticClient({
    clientId: process.env.PRISMATIC_CLIENT_ID,
    clientSecret: process.env.PRISMATIC_CLIENT_SECRET,
  });

  await client.login();

  const buildResult = await client.buildIntegration({
    path: "./src",
    name: "shopify-nautical-integration",
  });

  const publishResult = await client.publishIntegration({
    integrationId: buildResult.integrationId,
    version: buildResult.version,
  });

  console.log(`Published integration version ${publishResult.version}`);
}

deployIntegration().catch(console.error);
