/**
 * ChangeLog: tracks user edits on the diagram for delta reporting to AI.
 *
 * Records rename and layout-change operations. On "Send to Agent", the log is
 * serialized to natural language and sent alongside the full diagram state.
 */

export type Change =
  | { type: "rename"; nodeId: string; oldLabel: string; newLabel: string }
  | { type: "layout-change"; oldDirection: string; newDirection: string };

export class ChangeLog {
  private changes: Change[] = [];

  add(change: Change): void {
    // Coalesce consecutive renames for the same node
    if (change.type === "rename" && this.changes.length > 0) {
      const last = this.changes[this.changes.length - 1];
      if (last.type === "rename" && last.nodeId === change.nodeId) {
        // Keep the original oldLabel, update newLabel
        this.changes[this.changes.length - 1] = {
          ...change,
          oldLabel: last.oldLabel,
        };
        return;
      }
    }

    // Coalesce consecutive layout-change entries
    if (change.type === "layout-change" && this.changes.length > 0) {
      const last = this.changes[this.changes.length - 1];
      if (last.type === "layout-change") {
        // Keep the original oldDirection, update newDirection
        this.changes[this.changes.length - 1] = {
          ...change,
          oldDirection: last.oldDirection,
        };
        return;
      }
    }

    this.changes.push(change);
  }

  serialize(): string {
    if (this.changes.length === 0) return "";

    return this.changes
      .map((c, i) => {
        const num = `${i + 1}.`;
        switch (c.type) {
          case "rename":
            return `${num} Renamed node '${c.nodeId}' from '${c.oldLabel}' to '${c.newLabel}'`;
          case "layout-change":
            return `${num} Changed layout direction from ${c.oldDirection} to ${c.newDirection}`;
        }
      })
      .join("\n");
  }

  clear(): void {
    this.changes = [];
  }

  get count(): number {
    return this.changes.length;
  }

  get isEmpty(): boolean {
    return this.changes.length === 0;
  }
}
