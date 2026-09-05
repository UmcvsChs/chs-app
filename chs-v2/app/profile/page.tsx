"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/imageCompression";
import LivenessCheck from "@/components/LivenessCheck";
import BiometricSetup from "@/components/BiometricSetup";
import BankAccountSecurity from "@/components/BankAccountSecurity";
import { formatNaira } from "@/lib/format";

// A real profile picture / avatar — genuinely useful as a means of
// identification, especially for agents and other professionals where
// a name alone can be ambiguous. Any registered person can upload one.
const ROLE_DASHBOARD_PATHS: Record<string, string> = {
  admin: "/admin", owner: "/owner", host: "/host", agent: "/agent", manager: "/manager",
  tenant: "/tenant", buyer: "/", guest: "/guest", staff: "/staff", developer: "/developer",
};

export default function ProfilePage() {
  const router = useRouter();
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [livenessStatus, setLivenessStatus] = useState<"not_started" | "pending_review" | "approved" | "rejected">("not_started");
  const [checkingLiveness, setCheckingLiveness] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [profileState, setProfileState] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editState, setEditState] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState<string | null>(null);
  const [notifyOffers, setNotifyOffers] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyMarketing, setNotifyMarketing] = useState(true);
  const [diasporaMode, setDiasporaMode] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase.from("wallets").select("main_balance").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setWalletBalance(data?.main_balance ?? 0));
    supabase.from("profiles").select("phone, notify_offers, notify_messages, notify_marketing, diaspora_mode, residential_address, state")
      .eq("id", session.user.id).single()
      .then(({ data }) => {
        if (!data) return;
        setPhone(data.phone || "");
        setNotifyOffers(data.notify_offers ?? true);
        setNotifyMessages(data.notify_messages ?? true);
        setNotifyMarketing(data.notify_marketing ?? true);
        setDiasporaMode(data.diaspora_mode ?? false);
        setResidentialAddress(data.residential_address || "");
        setProfileState(data.state || "");
      });
  }, [session]);

  async function handleSaveProfileDetails() {
    if (!session) return;
    setSavingProfile(true);
    setProfileSaveMessage(null);
    const { error: rpcError } = await supabase.rpc("update_profile_details", {
      p_full_name: editName.trim() || null,
      p_phone: editPhone.trim() || null,
      p_residential_address: editAddress.trim() || null,
      p_state: editState.trim() || null,
    });
    setSavingProfile(false);
    if (rpcError) {
      setProfileSaveMessage(rpcError.message);
      return;
    }
    setPhone(editPhone.trim());
    setResidentialAddress(editAddress.trim());
    setProfileState(editState.trim());
    setEditingProfile(false);
    await refreshProfile();
  }

  async function handleDeactivate() {
    setDeactivating(true);
    await supabase.rpc("deactivate_my_account");
    window.location.reload();
  }

  async function handleSaveSettings() {
    if (!session) return;
    await supabase.from("profiles").update({
      notify_offers: notifyOffers,
      notify_messages: notifyMessages,
      notify_marketing: notifyMarketing,
      diaspora_mode: diasporaMode,
    }).eq("id", session.user.id);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }


  useEffect(() => {
    if (!session) return;
    supabase
      .from("liveness_submissions")
      .select("status")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setLivenessStatus(data?.status || "not_started");
        setCheckingLiveness(false);
      });
  }, [session]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose a real image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Please choose an image under 5MB.");
      return;
    }

    setError(null);
    setUploading(true);
    setPreview(URL.createObjectURL(file));

    // Real, consistent fix — the same compression used for property
    // photos applies here too, for the same real storage benefit.
    const compressed = await compressImage(file);
    const ext = compressed.name.split(".").pop();
    const path = `${session.user.id}/avatar/photo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("property-media").upload(path, compressed, { upsert: true });
    if (uploadError) {
      setError("Could not upload this image. Please try again.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("property-media").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", session.user.id);

    if (updateError) {
      setError("Could not save your new picture. Please try again.");
      setUploading(false);
      return;
    }

    await refreshProfile();
    setUploading(false);
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }
  if (!session) {
    router.push("/login");
    return null;
  }

  const currentAvatar = preview || profile?.avatar_url;

  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <button onClick={() => router.back()} className="text-xs text-gray-400 mb-4 inline-block">← Back</button>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">My Profile</h1>
        <p className="text-sm text-gray-500 mb-6">
          Add a photo or logo — real identification helps clients and customers recognise you.
        </p>

        <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-6 flex flex-col items-center">
          <div className="w-28 h-28 rounded-full bg-chs-amber-light overflow-hidden flex items-center justify-center mb-4">
            {currentAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentAvatar} alt="Your profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-chs-amber-dark">
                {profile?.full_name?.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-chs-charcoal mb-1">{profile?.full_name}</p>
          <p className="text-xs text-gray-400 mb-2 capitalize">{profile?.role}</p>

          {/* Real, direct fix per a repeated client request: every
              real role on this account, with a genuine, one-tap way
              to switch dashboards — and a real, visible way to add
              another role without ever leaving this page. */}
          {profile && [profile.role, ...(profile.secondary_roles || [])].length > 1 && (
            <div className="w-full mb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">My real roles — tap to switch</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {[profile.role, ...(profile.secondary_roles || [])].map((r) => (
                  <Link key={r} href={ROLE_DASHBOARD_PATHS[r] || "/"}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-chs-amber-light text-chs-charcoal capitalize">
                    {r}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <Link href="/link-account" className="text-[11px] font-semibold text-chs-red underline mb-4 block">
            + Add another role to my account
          </Link>

          <label className="w-full">
            <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="hidden" />
            <span className="block w-full text-center py-3 rounded-full bg-chs-red text-white text-sm font-semibold cursor-pointer">
              {uploading ? "Uploading..." : currentAvatar ? "Change photo/logo" : "Upload photo/logo"}
            </span>
          </label>

          {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mt-3 w-full text-center">{error}</p>}
        </div>

        <div className="mt-4">
          {!checkingLiveness && session && (
            livenessStatus === "approved" ? (
              <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2.5 text-center">
                ✓ Facial verification approved
              </p>
            ) : livenessStatus === "pending_review" ? (
              <p className="text-xs text-chs-amber-dark bg-chs-amber-light rounded-lg px-3 py-2.5 text-center">
                ⏳ Your facial verification is under real CHS review — you&apos;ll be notified once it&apos;s checked.
              </p>
            ) : (
              <LivenessCheck session={session} onSubmitted={() => setLivenessStatus("pending_review")} />
            )
          )}
        </div>

        <div className="mt-4">
          <BiometricSetup />
        </div>

        {/* Real Wallet summary — restored, found missing. */}
        <Link href="/wallet" className="block mt-4 bg-chs-charcoal rounded-xl p-4">
          <p className="text-[10px] text-white/60 uppercase">My Wallet</p>
          <div className="flex justify-between items-center mt-1">
            <p className="text-xl font-serif font-bold text-white">{walletBalance !== null ? formatNaira(walletBalance) : "..."}</p>
            <span className="bg-chs-red text-white text-xs font-bold px-3 py-1.5 rounded-full">+ Top Up</span>
          </div>
        </Link>

        {/* Real "Edit Profile" — genuinely didn't exist before; only
            the name was ever shown, never editable. A real name
            change here correctly resets ID/liveness verification,
            since the original verification was for the old name. */}
        <div className="mt-4 bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-bold text-chs-charcoal">Edit Profile</p>
            {!editingProfile && (
              <button onClick={() => {
                setEditName(profile?.full_name || "");
                setEditPhone(phone);
                setEditAddress(residentialAddress);
                setEditState(profileState);
                setEditingProfile(true);
              }} className="text-[10px] font-semibold text-chs-red underline">Edit</button>
            )}
          </div>
          {!editingProfile ? (
            <div className="space-y-1.5 text-sm text-gray-600">
              <p><strong className="text-chs-charcoal">Name:</strong> {profile?.full_name}</p>
              <p><strong className="text-chs-charcoal">Phone:</strong> {phone || "Not set"}</p>
              <p><strong className="text-chs-charcoal">Address:</strong> {residentialAddress || "Not set"}</p>
              <p><strong className="text-chs-charcoal">State:</strong> {profileState || "Not set"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-chs-amber-dark bg-chs-amber-light rounded-lg px-2 py-1.5">
                ⚠️ Changing your name will reset your ID/liveness verification — you&apos;ll need to re-verify.
              </p>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Full name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Phone number</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Residential address</label>
                <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">State</label>
                <input type="text" value={editState} onChange={(e) => setEditState(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </div>
              {profileSaveMessage && <p className="text-[10px] text-chs-red">{profileSaveMessage}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setEditingProfile(false); setProfileSaveMessage(null); }}
                  className="flex-1 py-2 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold">Cancel</button>
                <button onClick={handleSaveProfileDetails} disabled={savingProfile}
                  className="flex-1 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                  {savingProfile ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Real Settings — restored, found missing entirely. */}
        <div className="mt-4 bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-chs-charcoal mb-3">Settings</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 mt-2">Notification preferences</p>
          <div className="space-y-2 mb-3">
            {[
              { label: "Offers & applications", value: notifyOffers, set: setNotifyOffers },
              { label: "Messages", value: notifyMessages, set: setNotifyMessages },
              { label: "News & promotions", value: notifyMarketing, set: setNotifyMarketing },
            ].map((pref) => (
              <label key={pref.label} className="flex items-center justify-between">
                <span className="text-xs text-gray-600">{pref.label}</span>
                <input type="checkbox" checked={pref.value} onChange={(e) => pref.set(e.target.checked)} />
              </label>
            ))}
          </div>

          <label className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-600">🌍 Diaspora Mode</span>
            <input type="checkbox" checked={diasporaMode} onChange={(e) => setDiasporaMode(e.target.checked)} />
          </label>

          <button onClick={handleSaveSettings} className="w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold mb-3">
            {settingsSaved ? "✓ Saved" : "Save settings"}
          </button>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Bank account for withdrawals</p>
            {session && <BankAccountSecurity session={session} registeredName={profile?.full_name || ""} />}
          </div>

          <div className="border-t border-gray-100 pt-3 mt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Account</p>
            {showDeactivateConfirm ? (
              <div className="bg-chs-amber-light rounded-lg p-3">
                <p className="text-[11px] text-chs-amber-dark mb-2">
                  This temporarily hides your account and listings from CHS. Nothing is deleted — log back in any time to reactivate instantly.
                </p>
                <div className="flex gap-2">
                  <button onClick={handleDeactivate} disabled={deactivating}
                    className="flex-1 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                    {deactivating ? "Deactivating..." : "Yes, deactivate my account"}
                  </button>
                  <button onClick={() => setShowDeactivateConfirm(false)} className="px-3 py-2 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowDeactivateConfirm(true)} className="text-xs text-gray-400 underline">
                Deactivate my account
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
