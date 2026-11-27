import { buildClientMetadata, parseAppOrigin } from "./config";
import { SpaceChartStore } from "./store";

export type AtprotoClient = {
  did?: string;
  charts?: Pick<
    SpaceChartStore,
    "findSpace" | "createSpace" | "loadChart" | "saveChart" | "deleteChart"
  >;
  signIn(handle: string): Promise<void>;
  signOut(): Promise<void>;
  dispose(): Promise<void>;
};

export async function createAtprotoClient(
  pageUrl: string,
): Promise<AtprotoClient> {
  const origin = parseAppOrigin(pageUrl);

  // The alpha SDK stays outside the main application and server rendering.
  const { BrowserOAuthClient } = await import("@atproto/oauth-client-browser");
  const client = new BrowserOAuthClient({
    clientMetadata: buildClientMetadata(origin),
    handleResolver: "https://bsky.social",
  });
  try {
    const result = await client.init();
    const session = result?.session;
    return {
      did: session?.did,
      charts: session ? new SpaceChartStore(session) : undefined,
      signIn: (handle) => client.signInRedirect(handle),
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
