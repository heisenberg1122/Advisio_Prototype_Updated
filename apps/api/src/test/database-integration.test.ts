import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { assertIsolatedIntegrationDatabase } from "./database-integration.js";

const TEST_URL =
  "postgresql://advisio_test:test-password@127.0.0.1:5434/advisio_test?schema=public&application_name=advisio-integration-tests";

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    RUN_DATABASE_INTEGRATION_TESTS: "1",
    INTEGRATION_TEST_RUN_ID: "database-guard-unit-test",
    INTEGRATION_DATABASE_EXPECTED_NAME: "advisio_test",
    INTEGRATION_DATABASE_URL: TEST_URL,
    DATABASE_URL: TEST_URL,
    DIRECT_URL: TEST_URL,
    ...overrides,
  };
}

function client(
  overrides: Partial<{
    databaseName: string;
    databaseUser: string;
    schemaName: string;
    applicationName: string;
    serverAddress: string | null;
    serverPort: number | null;
    isReplica: boolean;
  }> = {},
): PrismaClient {
  return {
    $queryRawUnsafe: vi.fn().mockResolvedValue([
      {
        databaseName: "advisio_test",
        databaseUser: "advisio_test",
        schemaName: "public",
        applicationName: "advisio-integration-tests",
        serverAddress: "127.0.0.1",
        serverPort: 5434,
        isReplica: false,
        ...overrides,
      },
    ]),
  } as unknown as PrismaClient;
}

describe("database integration safety guard", () => {
  it("accepts an explicitly configured live advisio_test connection", async () => {
    await expect(
      assertIsolatedIntegrationDatabase(client(), environment()),
    ).resolves.toMatchObject({
      databaseName: "advisio_test",
      databaseUser: "advisio_test",
      schemaName: "public",
    });
  });

  it("rejects normal unit-test or development environments", async () => {
    await expect(
      assertIsolatedIntegrationDatabase(
        client(),
        environment({ RUN_DATABASE_INTEGRATION_TESTS: "0" }),
      ),
    ).rejects.toThrow("RUN_DATABASE_INTEGRATION_TESTS=1");
    await expect(
      assertIsolatedIntegrationDatabase(
        client(),
        environment({ NODE_ENV: "development" }),
      ),
    ).rejects.toThrow("NODE_ENV=test");
  });

  it("rejects a development database even when its name contains no test marker", async () => {
    const developmentUrl = TEST_URL.replaceAll("advisio_test", "advisio_local");
    await expect(
      assertIsolatedIntegrationDatabase(
        client({
          databaseName: "advisio_local",
          databaseUser: "advisio_local",
        }),
        environment({
          INTEGRATION_DATABASE_URL: developmentUrl,
          DATABASE_URL: developmentUrl,
          DIRECT_URL: developmentUrl,
        }),
      ),
    ).rejects.toThrow('expected the dedicated database "advisio_test"');
  });

  it("rejects mismatched Prisma and integration targets", async () => {
    await expect(
      assertIsolatedIntegrationDatabase(
        client(),
        environment({ DIRECT_URL: TEST_URL.replace("5434", "5433") }),
      ),
    ).rejects.toThrow(
      "must point to the exact INTEGRATION_DATABASE_URL target",
    );
  });

  it("rejects a connection without the integration application identity", async () => {
    const unverifiedUrl = TEST_URL.replace(
      "advisio-integration-tests",
      "ordinary-api",
    );
    await expect(
      assertIsolatedIntegrationDatabase(
        client({ applicationName: "ordinary-api" }),
        environment({
          INTEGRATION_DATABASE_URL: unverifiedUrl,
          DATABASE_URL: unverifiedUrl,
          DIRECT_URL: unverifiedUrl,
        }),
      ),
    ).rejects.toThrow("application_name=advisio-integration-tests");
  });

  it("rejects a live server identity that differs from the URL", async () => {
    await expect(
      assertIsolatedIntegrationDatabase(
        client({ databaseName: "production" }),
        environment(),
      ),
    ).rejects.toThrow(
      "does not match the verified writable Advisio integration-test identity",
    );
  });
});
