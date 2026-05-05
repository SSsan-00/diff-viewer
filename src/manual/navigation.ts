export type ManualPresentationMode = "route" | "overlay";

type ManualPresentationOptions = {
  hasPaneSaveTargets: boolean;
  paneSaveTargetStoreAvailable: boolean;
  fileSystemAccessSupported: boolean;
};

function updateHashParams(
  hash: string,
  update: (params: URLSearchParams) => void,
): string {
  if (!hash || !hash.startsWith("#")) {
    return hash;
  }
  const body = hash.slice(1);
  if (!body.includes("=")) {
    return hash;
  }
  const params = new URLSearchParams(body);
  update(params);
  const next = params.toString();
  return next ? `#${next}` : "";
}

export function createManualUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.set("manual", "on");
  return url.toString();
}

export function createAppUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("manual");
  url.hash = updateHashParams(url.hash, (params) => {
    params.delete("manual");
  });
  return url.toString();
}

export function resolveManualPresentationMode(
  options: ManualPresentationOptions,
): ManualPresentationMode {
  if (!options.hasPaneSaveTargets) {
    return "route";
  }
  return options.paneSaveTargetStoreAvailable && options.fileSystemAccessSupported
    ? "route"
    : "overlay";
}
