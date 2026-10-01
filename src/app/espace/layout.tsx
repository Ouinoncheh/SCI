import { loadWorkspace } from '@/server/load-workspace';
import { DemoProvider } from '@/ui/demo-context';
import { Shell } from '@/ui/shell';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const workspace = await loadWorkspace();
  const key = JSON.stringify([
    workspace.sci?.id,
    workspace.user,
    workspace.role,
    workspace.sci?.members,
    workspace.items.map((p) => [p.id, p.version, p.favorite]),
  ]);
  return (
    <DemoProvider key={key} workspace={workspace}>
      <Shell>{children}</Shell>
    </DemoProvider>
  );
}
