import type { WorkspaceDocument } from "./types";

const HISTORY_LIMIT = 100;

export type WorkspaceHistory = {
  past: WorkspaceDocument[];
  present: WorkspaceDocument;
  future: WorkspaceDocument[];
  transactionStart: WorkspaceDocument | null;
};

export type WorkspaceHistoryAction =
  | {
      type: "change";
      update: (document: WorkspaceDocument) => WorkspaceDocument;
    }
  | { type: "begin" | "commit" | "cancel" | "undo" | "redo" };

export function createWorkspaceHistory(
  document: WorkspaceDocument,
): WorkspaceHistory {
  return { past: [], present: document, future: [], transactionStart: null };
}

function commitTransaction(state: WorkspaceHistory): WorkspaceHistory {
  const start = state.transactionStart;
  if (!start) return state;

  // 드래그하다 제자리로 돌아오면 이력과 미저장 상태를 늘리지 않는다.
  if (
    start === state.present ||
    JSON.stringify(start) === JSON.stringify(state.present)
  ) {
    return { ...state, present: start, transactionStart: null };
  }

  return {
    past: [...state.past, start].slice(-HISTORY_LIMIT),
    present: state.present,
    future: [],
    transactionStart: null,
  };
}

export function workspaceHistoryReducer(
  state: WorkspaceHistory,
  action: WorkspaceHistoryAction,
): WorkspaceHistory {
  switch (action.type) {
    case "change": {
      const next = action.update(state.present);
      if (next === state.present) return state;
      if (state.transactionStart) return { ...state, present: next };

      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
        transactionStart: null,
      };
    }
    case "begin": {
      const committed = commitTransaction(state);
      return { ...committed, transactionStart: committed.present };
    }
    case "commit":
      return commitTransaction(state);
    case "cancel":
      return state.transactionStart
        ? { ...state, present: state.transactionStart, transactionStart: null }
        : state;
    case "undo": {
      const committed = commitTransaction(state);
      const previous = committed.past.at(-1);
      if (!previous) return committed;
      return {
        past: committed.past.slice(0, -1),
        present: previous,
        future: [committed.present, ...committed.future].slice(
          0,
          HISTORY_LIMIT,
        ),
        transactionStart: null,
      };
    }
    case "redo": {
      const committed = commitTransaction(state);
      const next = committed.future[0];
      if (!next) return committed;
      return {
        past: [...committed.past, committed.present].slice(-HISTORY_LIMIT),
        present: next,
        future: committed.future.slice(1),
        transactionStart: null,
      };
    }
  }
}
