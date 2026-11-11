export type TabProps = {
  /** False for a view-only admin: controls are hidden or disabled. */
  canEdit: boolean;
  /** Where the tab puts its header buttons (right of the page title); null until mounted. */
  actions: HTMLElement | null;
  /** Reports unsaved changes, so leaving the tab can ask first. */
  onDirty: (dirty: boolean) => void;
};
