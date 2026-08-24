export type PaneOperationSide = "left" | "right";

export type PaneOperationGenerations = Readonly<
  Record<PaneOperationSide, number>
>;

export type PaneOperationGenerationToken = Readonly<{
  side: PaneOperationSide;
  generation: number;
}>;

export function createPaneOperationGenerations(): PaneOperationGenerations {
  return { left: 0, right: 0 };
}

export function capturePaneOperationGeneration(
  generations: PaneOperationGenerations,
  side: PaneOperationSide,
): PaneOperationGenerationToken {
  return { side, generation: generations[side] };
}

export function advancePaneOperationGeneration(
  generations: PaneOperationGenerations,
  side: PaneOperationSide,
): PaneOperationGenerations {
  return {
    ...generations,
    [side]: generations[side] + 1,
  };
}

export function invalidatePaneOperationGenerations(
  generations: PaneOperationGenerations,
): PaneOperationGenerations {
  return {
    left: generations.left + 1,
    right: generations.right + 1,
  };
}

export function isPaneOperationGenerationCurrent(
  generations: PaneOperationGenerations,
  token: PaneOperationGenerationToken,
): boolean {
  return generations[token.side] === token.generation;
}
