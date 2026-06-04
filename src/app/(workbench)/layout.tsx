import type { ReactNode } from "react";
import { WorkbenchShell } from "@/features/workspace/workbench-shell";
import { WorkspaceProvider } from "@/features/workspace/workspace-context";

export default function WorkbenchLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <WorkbenchShell>{children}</WorkbenchShell>
    </WorkspaceProvider>
  );
}
