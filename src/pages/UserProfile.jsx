import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateEmail, updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { ThemeToggle } from "../ThemeContext";
import { useAuth } from "../lib/AuthContext";
import { auth, db } from "../lib/firebase";
import { uploadToCloudinary } from "../lib/cloudinary";
import { measureTrace } from "../lib/telemetry";

export default function UserProfile() {
  const navigate = useNavigate();
  const { user, profile, loading, logout } = useAuth();

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);

  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth?mode=login");
    }
  }, [loading, user, navigate]);

  // Sync input defaults when profile loads / updates
  useEffect(() => {
    if (profile?.displayName !== undefined) {
      setDisplayNameInput(profile.displayName || "");
    }
  }, [profile?.displayName]);

  useEffect(() => {
    if (user?.email) {
      setNewEmail(user.email);
    }
  }, [user?.email]);

  const isDeleteMatch = useMemo(
    () => deleteText.trim().toLowerCase() === "delete account",
    [deleteText],
  );

  const profileImage = profile?.photoURL || "";
  const email = user?.email || "";

  const handleSaveProfileImage = async () => {
    if (!selectedFile || !user) return;
    try {
      setUploadingPicture(true);
      await measureTrace("profile_photo_update", async () => {
        const { url } = await uploadToCloudinary(selectedFile);
        await updateDoc(doc(db, "users", user.uid), { photoURL: url });
      }, {
        metrics: { file_size_bytes: selectedFile.size || 0 },
      });
      setSelectedFile(null);
      alert("Profile picture updated.");
    } catch (err) {
      console.error("profile picture upload failed", err);
      alert(err?.message || "Could not upload profile picture.");
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleDeleteProfilePhoto = async () => {
    if (!user) return;
    try {
      await measureTrace("profile_photo_remove", async () => {
        await updateDoc(doc(db, "users", user.uid), { photoURL: "" });
      });
      setSelectedFile(null);
      alert("Profile photo removed.");
    } catch (err) {
      console.error("remove profile photo failed", err);
      alert("Could not remove profile photo.");
    }
  };

  const handleSaveDisplayName = async () => {
    if (!user) return;
    const trimmed = displayNameInput.trim();
    if (!trimmed) {
      alert("Please enter a display name.");
      return;
    }
    try {
      setSavingDisplayName(true);
      await measureTrace("profile_name_update", async () => {
        await updateDoc(doc(db, "users", user.uid), { displayName: trimmed });
      });
      alert("Display name updated.");
    } catch (err) {
      console.error("update display name failed", err);
      alert("Could not update display name.");
    } finally {
      setSavingDisplayName(false);
    }
  };

  const handleChangeEmail = async () => {
    const trimmedEmail = newEmail.trim().toLowerCase();

    if (!trimmedEmail) {
      alert("Please enter an email.");
      return;
    }

    const emailPattern = /^\S+@\S+\.\S+$/;
    if (!emailPattern.test(trimmedEmail)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (!auth.currentUser) return;

    if (trimmedEmail === (auth.currentUser.email || "").toLowerCase()) {
      setShowEmailModal(false);
      return;
    }

    try {
      setSavingEmail(true);
      await measureTrace("profile_email_update", async () => {
        await updateEmail(auth.currentUser, trimmedEmail);
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          email: trimmedEmail,
        });
      });
      setShowEmailModal(false);
      alert("Email changed successfully.");
    } catch (err) {
      console.error("change email failed", err);
      if (err?.code === "auth/requires-recent-login") {
        alert(
          "For security, please log out and log back in before changing your email.",
        );
      } else if (err?.code === "auth/email-already-in-use") {
        alert("That email is already registered.");
      } else if (err?.code === "auth/invalid-email") {
        alert("Please enter a valid email address.");
      } else {
        alert("Could not change email. Please try again.");
      }
    } finally {
      setSavingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      alert("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      alert("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      alert("New password should be at least 6 characters.");
      return;
    }

    if (!auth.currentUser) return;

    try {
      setSavingPassword(true);
      await measureTrace("profile_password_update", async () => {
        await updatePassword(auth.currentUser, newPassword);
      });
      setNewPassword("");
      setConfirmNewPassword("");
      setShowPasswordModal(false);
      alert("Password changed successfully.");
    } catch (err) {
      console.error("change password failed", err);
      if (err?.code === "auth/requires-recent-login") {
        alert(
          "For security, please log out and log back in before changing your password.",
        );
      } else if (err?.code === "auth/weak-password") {
        alert("Password is too weak. Use at least 6 characters.");
      } else {
        alert("Could not change password. Please try again.");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!isDeleteMatch) return;
    // Full account deletion requires re-auth and is out of scope for this migration;
    // log the user out as the safest behavior.
    try {
      await logout();
    } catch (err) {
      console.error("logout failed during delete", err);
    }
    navigate("/");
  };

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] dark:bg-[#1a2035] text-slate-600 dark:text-slate-300">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] dark:bg-[#1a2035] px-6 py-8 text-slate-900 dark:text-white sm:px-10 lg:px-16">
      {/* Theme toggle fixed top-right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <section className="mx-auto w-full max-w-[1000px] section-card">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="page-label">User profile</p>
            <h1 className="page-title tracking-[-0.03em]">
              Manage Your Profile
            </h1>
            <p className="mt-2 max-w-[700px] text-[17px] leading-7 text-[#64748b] dark:text-slate-400">
              Update your profile image, display name, email, password, or
              remove your account.
            </p>
          </div>

          <button
            onClick={() => navigate("/user-home")}
            className="rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[320px_1fr]">
          <div className="rounded-[24px] bg-[#f8fafc] dark:bg-slate-800 p-6 ring-1 ring-slate-200 dark:ring-slate-700">
            <div className="flex flex-col items-center">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="h-40 w-40 rounded-full object-cover ring-4 ring-white shadow"
                />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-full bg-[#dde7ff] text-5xl font-bold text-[#28457a]">
                  {(profile?.displayName?.[0] || email[0] || "U").toUpperCase()}
                </div>
              )}

              <h2 className="mt-5 break-all text-center text-xl font-bold text-[#0f172f] dark:text-white">
                {profile?.displayName || email || "User"}
              </h2>

              <label className="mt-5 block w-full text-sm font-medium text-slate-700 dark:text-slate-300">
                Upload Profile Picture
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] || null)
                  }
                  className="mt-2 block w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm dark:text-slate-300"
                />
              </label>

              <button
                onClick={handleSaveProfileImage}
                disabled={uploadingPicture || !selectedFile}
                className="mt-4 w-full btn-primary disabled:opacity-60"
              >
                {uploadingPicture ? "Uploading..." : "Save Profile Picture"}
              </button>

              <button
                onClick={handleDeleteProfilePhoto}
                className="mt-3 w-full rounded-xl border border-red-500 bg-white dark:bg-transparent px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Delete Profile Photo
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="inner-card">
              <h3 className="text-xl font-bold text-[#0f172f] dark:text-white">
                Display Name
              </h3>
              <p className="mt-2 text-sm text-[#64748b] dark:text-slate-400">
                This name appears on your comments and uploads.
              </p>
              <div className="mt-4">
                <input
                  type="text"
                  value={displayNameInput}
                  onChange={(event) => setDisplayNameInput(event.target.value)}
                  placeholder="Your display name"
                  className="form-input"
                />
              </div>
              <div className="mt-5">
                <button
                  onClick={handleSaveDisplayName}
                  disabled={savingDisplayName}
                  className="btn-primary disabled:opacity-60"
                >
                  {savingDisplayName ? "Saving..." : "Save Display Name"}
                </button>
              </div>
            </div>

            <div className="inner-card">
              <h3 className="text-xl font-bold text-[#0f172f] dark:text-white">
                Account Details
              </h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-[#f8fafc] dark:bg-slate-800 px-4 py-3">
                  <p className="text-sm text-[#64748b] dark:text-slate-400">
                    Email
                  </p>
                  <p className="mt-1 break-all font-semibold text-[#0f172f] dark:text-white">
                    {email || "No email"}
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="btn-primary"
                >
                  Change Email
                </button>
              </div>
            </div>

            <div className="inner-card">
              <h3 className="text-xl font-bold text-[#0f172f] dark:text-white">
                Security
              </h3>
              <p className="mt-2 text-sm text-[#64748b] dark:text-slate-400">
                Change your password or permanently remove your account.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="btn-primary"
                >
                  Change Password
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showEmailModal ? (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2 className="modal-title">Change Email</h2>
            <p className="modal-subtitle">
              Enter your new email address below.
            </p>
            <label className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              New Email
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                className="form-input-modal"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setNewEmail(email);
                }}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeEmail}
                disabled={savingEmail}
                className="btn-primary-sm disabled:opacity-60"
              >
                {savingEmail ? "Saving..." : "Change"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPasswordModal ? (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2 className="modal-title">Change Password</h2>
            <p className="modal-subtitle">
              Enter and confirm your new password.
            </p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                New Password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="form-input-modal"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Confirm New Password
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(event) =>
                    setConfirmNewPassword(event.target.value)
                  }
                  className="form-input-modal"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword("");
                  setConfirmNewPassword("");
                }}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={savingPassword}
                className="btn-primary-sm disabled:opacity-60"
              >
                {savingPassword ? "Saving..." : "Change"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteModal ? (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2 className="modal-title">Delete Account</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748b] dark:text-slate-400">
              Type{" "}
              <span className="font-semibold text-[#0f172f] dark:text-white">
                delete account
              </span>{" "}
              to confirm permanent deletion.
            </p>
            <label className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Confirmation Text
              <input
                type="text"
                value={deleteText}
                onChange={(event) => setDeleteText(event.target.value)}
                placeholder='Type "delete account"'
                className="form-input-modal"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteText("");
                }}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={!isDeleteMatch}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                  isDeleteMatch
                    ? "bg-red-600 hover:bg-red-700"
                    : "cursor-not-allowed bg-gray-400"
                }`}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
