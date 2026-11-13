import { buildClientMetadata, type TrialConfig } from "./config";
import { SpaceChartStore } from "./store";

export type TrialClient = {
  did?: string;
  charts?: Pick<SpaceChartStore, "loadChart" | "saveChart" | "deleteChart">;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  dispose(): Promise<void>;
};

export async function createTrialClient(
  config: TrialConfig,
): Promise<TrialClient> {
  // The alpha SDK stays outside the main application and server rendering.
  const { BrowserOAuthClient } = await import("@atproto/oauth-client-browser");
  const client = new BrowserOAuthClient({
    clientMetadata: buildClientMetadata(config),
    handleResolver: "https://bsky.social",
  });
  try {
    const result = await client.init();
    const session = result?.session;
    if (session && session.did !== config.allowedDid) {
      await session.signOut();
      throw new Error("This trial is restricted to the configured account.");
    }
    return {
      did: session?.did,
      charts: session ? new SpaceChartStore(session, config) : undefined,
      signIn: () => client.signInRedirect(config.allowedDid),
      signOut: async () => {
        await session?.signOut();
      },
      dispose: () => client.dispose(),
    };
  } catch (cause) {
    await client.dispose();
    throw cause;
  }
}
