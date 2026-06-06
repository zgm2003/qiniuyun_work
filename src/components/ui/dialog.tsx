"use client";

import type { ReactNode } from "react";
import { UiButton } from "./button";

type UiDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
};

export function UiDialog({ open, title, description, children, onClose }: UiDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="ui-dialog-backdrop" role="presentation">
      <section className="ui-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ui-dialog-head">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <UiButton className="ui-dialog-close" variant="ghost" onClick={onClose} aria-label="关闭弹窗">
            ×
          </UiButton>
        </div>
        <div className="ui-dialog-body">{children}</div>
      </section>
    </div>
  );
}
