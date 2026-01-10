type NamedFile = { name: string };

function getBaseName(name: string, suffix: string): string {
  return name.slice(0, -suffix.length);
}

function lower(value: string): string {
  return value.toLowerCase();
}

function matchRazorPair(name: string): { base: string; type: "view" | "code" } | null {
  const lowerName = lower(name);
  if (lowerName.endsWith(".cshtml.cs")) {
    return { base: getBaseName(name, ".cshtml.cs"), type: "code" };
  }
  if (lowerName.endsWith(".cshtml")) {
    return { base: getBaseName(name, ".cshtml"), type: "view" };
  }
  return null;
}

export function reorderRazorPairs<T extends NamedFile>(files: readonly T[]): T[] {
  const result = [...files];
  const pairMap = new Map<string, { view: number[]; code: number[] }>();

  result.forEach((file, index) => {
    const match = matchRazorPair(file.name);
    if (!match) {
      return;
    }
    const key = lower(match.base);
    const entry = pairMap.get(key) ?? { view: [], code: [] };
    if (match.type === "view") {
      entry.view.push(index);
    } else {
      entry.code.push(index);
    }
    pairMap.set(key, entry);
  });

  pairMap.forEach((entry) => {
    const pairCount = Math.min(entry.view.length, entry.code.length);
    for (let i = 0; i < pairCount; i += 1) {
      const viewIndex = entry.view[i];
      const codeIndex = entry.code[i];
      if (codeIndex < viewIndex) {
        continue;
      }
      const temp = result[viewIndex];
      result[viewIndex] = result[codeIndex];
      result[codeIndex] = temp;
    }
  });

  return result;
}
