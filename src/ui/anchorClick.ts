import { addAnchor, removeAnchorByLeft, removeAnchorByRight, type Anchor } from "../diffEngine/anchors";

type AnchorClickState = {
  manualAnchors: Anchor[];
  pendingLeftLineNo: number | null;
  pendingRightLineNo: number | null;
  autoAnchor: Anchor | null;
  suppressedAutoAnchorKey: string | null;
  lineNo: number;
};

export type AnchorClickAction =
  | "pending-set"
  | "pending-cleared"
  | "added"
  | "removed"
  | "auto-removed";

export type AnchorClickResult = {
  manualAnchors: Anchor[];
  pendingLeftLineNo: number | null;
  pendingRightLineNo: number | null;
  autoAnchor: Anchor | null;
  suppressedAutoAnchorKey: string | null;
  action: AnchorClickAction;
  removedAnchor?: Anchor;
  addedAnchor?: Anchor;
};

function autoAnchorKey(anchor: Anchor): string {
  return `auto:${anchor.leftLineNo}:${anchor.rightLineNo}`;
}

export function handleLeftAnchorClick(state: AnchorClickState): AnchorClickResult {
  const { manualAnchors, pendingLeftLineNo, pendingRightLineNo, autoAnchor, lineNo } = state;
  const removal = removeAnchorByLeft(manualAnchors, lineNo);
  if (removal.removed) {
    return {
      manualAnchors: removal.next,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      autoAnchor,
      suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
      action: "removed",
      removedAnchor: removal.removed,
    };
  }

  if (autoAnchor && autoAnchor.leftLineNo === lineNo) {
    return {
      manualAnchors,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      autoAnchor: null,
      suppressedAutoAnchorKey: autoAnchorKey(autoAnchor),
      action: "auto-removed",
    };
  }

  if (pendingRightLineNo !== null) {
    const anchor = { leftLineNo: lineNo, rightLineNo: pendingRightLineNo };
    return {
      manualAnchors: addAnchor(manualAnchors, anchor),
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      autoAnchor,
      suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
      action: "added",
      addedAnchor: anchor,
    };
  }

  if (pendingLeftLineNo === lineNo) {
    return {
      manualAnchors,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      autoAnchor,
      suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
      action: "pending-cleared",
    };
  }

  return {
    manualAnchors,
    pendingLeftLineNo: lineNo,
    pendingRightLineNo: null,
    autoAnchor,
    suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
    action: "pending-set",
  };
}

export function handleRightAnchorClick(state: AnchorClickState): AnchorClickResult {
  const { manualAnchors, pendingLeftLineNo, pendingRightLineNo, autoAnchor, lineNo } = state;
  const removal = removeAnchorByRight(manualAnchors, lineNo);
  if (removal.removed) {
    return {
      manualAnchors: removal.next,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      autoAnchor,
      suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
      action: "removed",
      removedAnchor: removal.removed,
    };
  }

  if (autoAnchor && autoAnchor.rightLineNo === lineNo) {
    return {
      manualAnchors,
      pendingLeftLineNo: null,
      pendingRightLineNo: null,
      autoAnchor: null,
      suppressedAutoAnchorKey: autoAnchorKey(autoAnchor),
      action: "auto-removed",
    };
  }

  if (pendingLeftLineNo === null) {
    if (pendingRightLineNo === lineNo) {
      return {
        manualAnchors,
        pendingLeftLineNo: null,
        pendingRightLineNo: null,
        autoAnchor,
        suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
        action: "pending-cleared",
      };
    }
    return {
      manualAnchors,
      pendingLeftLineNo: null,
      pendingRightLineNo: lineNo,
      autoAnchor,
      suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
      action: "pending-set",
    };
  }

  const anchor = { leftLineNo: pendingLeftLineNo, rightLineNo: lineNo };
  return {
    manualAnchors: addAnchor(manualAnchors, anchor),
    pendingLeftLineNo: null,
    pendingRightLineNo: null,
    autoAnchor,
    suppressedAutoAnchorKey: state.suppressedAutoAnchorKey,
    action: "added",
    addedAnchor: anchor,
  };
}
