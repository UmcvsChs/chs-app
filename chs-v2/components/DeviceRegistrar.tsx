"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getDeviceId, describeDevice } from "@/lib/device";

// Tells CHS which device a signed-in person is using, once per visit. A device that is new to the account triggers an alert to the
// account holder, and large transfers or withdrawals from it need extra confirmation until it has been used for a day.
export default function DeviceRegistrar() {
  const { session } = useAuth();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    supabase.rpc("register_device", { p_device_id: getDeviceId(), p_label: describeDevice() }).then(() => {});
  }, [userId]);
  return null;
}
