import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { QueueTicket } from "@/components/QueueTicket";
import {
  getNotificationsForEntry,
  getQueueEntryByToken,
} from "@/lib/data/queue";
import { isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { token: string };
}

export default async function QueueTokenPage({ params }: PageProps) {
  const token = decodeURIComponent(params.token);
  const entry = await getQueueEntryByToken(token);

  if (!entry) {
    notFound();
  }

  const notifications = await getNotificationsForEntry(entry.id);
  const demo = isDemoMode();

  return (
    <main>
      <Navbar />
      <div className="mx-auto max-w-lg px-6 py-14">
        <Link href="/dashboard" className="text-sm font-medium text-leaf-700 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-soil-900">
          Your queue token
        </h1>
        <p className="mt-1 text-sm text-soil-600">
          Show this token at the procurement centre gate. Status updates live.
        </p>
        <div className="mt-8">
          <QueueTicket
            initialEntry={entry}
            initialNotifications={notifications}
            demoLive={demo}
          />
        </div>
      </div>
    </main>
  );
}