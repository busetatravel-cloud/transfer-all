import { TasksModule } from "@/components/tasks-module";
import { requireBusinessSession } from "@/lib/auth";
import { listTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TasksPage() {
  const session = await requireBusinessSession();
  const tasks = await listTasks(session.businessId);

  return <TasksModule businessId={session.businessId} initialTasks={tasks} />;
}
