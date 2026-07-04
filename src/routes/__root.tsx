import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display text-gold-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Off the record.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page isn't in the vault. Let's get you back to the studio.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md gold-seal px-4 py-2 text-sm font-semibold text-onyx transition-transform hover:scale-[1.02]"
          >
            Back to the front door
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          A cable came loose.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something failed on our side. Try again — your work is safe locally.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md gold-seal px-4 py-2 text-sm font-semibold text-onyx"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RapWriter.ai — The Prep Studio™ for artists" },
      {
        name: "description",
        content:
          "RapWriter.ai is the luxury prep studio for rap artists. License beats, write to them, and go Booth Ready™ — all in one environment.",
      },
      { name: "author", content: "RapWriter.ai" },
      { name: "theme-color", content: "#0d0d0f" },
      { property: "og:site_name", content: "RapWriter.ai" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "RapWriter.ai — Go from idea to Booth Ready™" },
      {
        property: "og:description",
        content:
          "A luxury digital studio for rappers. Beats, writing, and certification in one place.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@rapwriterai" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
