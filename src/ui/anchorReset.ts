import type { Anchor } from "../diffEngine/anchors";

type EditorLike = {
  deltaDecorations: (oldDecorations: string[], newDecorations: unknown[]) => string[];
};

export type AnchorResetState = {
  manualAnchors: Anchor[];
  autoAnchor: Anchor | null;
  suppressedAutoAnchorKey: string | null;
  pendingLeftLineNo: number | null;
  pendingRightLineNo: number | null;
  selectedAnchorKey: string | null;
  pendingLeftDecorationIds: string[];
  pendingRightDecorationIds: string[];
  leftAnchorDecorationIds: string[];
  rightAnchorDecorationIds: string[];
  leftFocusDecorationIds: string[];
  rightFocusDecorationIds: string[];
};

export type AnchorResetEditors = {
  leftEditor: EditorLike;
  rightEditor: EditorLike;
};

export function resetAllAnchors(state: AnchorResetState, editors: AnchorResetEditors): AnchorResetState {
  editors.leftEditor.deltaDecorations(state.pendingLeftDecorationIds, []);
  editors.rightEditor.deltaDecorations(state.pendingRightDecorationIds, []);
  editors.leftEditor.deltaDecorations(state.leftAnchorDecorationIds, []);
  editors.rightEditor.deltaDecorations(state.rightAnchorDecorationIds, []);
  editors.leftEditor.deltaDecorations(state.leftFocusDecorationIds, []);
  editors.rightEditor.deltaDecorations(state.rightFocusDecorationIds, []);

  return {
    manualAnchors: [],
    autoAnchor: null,
    suppressedAutoAnchorKey: null,
    pendingLeftLineNo: null,
    pendingRightLineNo: null,
    selectedAnchorKey: null,
    pendingLeftDecorationIds: [],
    pendingRightDecorationIds: [],
    leftAnchorDecorationIds: [],
    rightAnchorDecorationIds: [],
    leftFocusDecorationIds: [],
    rightFocusDecorationIds: [],
  };
}
