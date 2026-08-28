"use server";

import { revalidatePath } from "next/cache";
import {
  adminQueueAction,
  joinQueue,
  resolveProcurementCentreId,
} from "@/lib/data/queue";
import type { AdminQueueAction, JoinQueueResult } from "@/lib/types";

export async function joinQueueAction(formData: {
  centreId: string;
  centreName?: string;
  displayName: string;
  phone?: string;
  location?: string;
  commodityName: string;
  quantity: number;
}): Promise<{ data: JoinQueueResult | null; error: string | null }> {
  const resolvedId = await resolveProcurementCentreId(
    formData.centreId,
    formData.centreName
  );
  if (!resolvedId) {
    return {
      data: null,
      error:
        "Could not resolve this centre. Join queue works for government procurement and APMC/mandi options returned by the recommendation engine.",
    };
  }

  const result = await joinQueue({
    ...formData,
    centreId: resolvedId,
  });

  if (result.data) {
    revalidatePath(`/queue/${result.data.token}`);
    revalidatePath(`/admin/${resolvedId}`);
  }

  return result;
}

/** Admin enters a farmer who showed up in person without using the site. */
export async function addOfflineFarmerAction(formData: {
  centreId: string;
  centreName?: string;
  displayName: string;
  phone?: string;
  commodityName: string;
  quantity: number;
  notes?: string;
}): Promise<{ data: JoinQueueResult | null; error: string | null }> {
  const result = await joinQueue({
    ...formData,
    source: "OFFLINE_ADMIN",
  });

  if (result.data) {
    revalidatePath(`/admin/${formData.centreId}`);
    revalidatePath(`/queue/${result.data.token}`);
  }

  return result;
}

export async function adminQueueActionServer(
  entryId: string,
  action: AdminQueueAction,
  centreId: string
): Promise<{ error: string | null }> {
  const result = await adminQueueAction(entryId, action);
  if (result.error) {
    return { error: result.error };
  }
  revalidatePath(`/admin/${centreId}`);
  if (result.data?.token) {
    revalidatePath(`/queue/${result.data.token}`);
  }
  return { error: null };
}
