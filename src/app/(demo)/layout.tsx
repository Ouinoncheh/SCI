import { DemoProvider } from '@/ui/demo-context';
import { Shell } from '@/ui/shell';
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <Shell>{children}</Shell>
    </DemoProvider>
  );
}
