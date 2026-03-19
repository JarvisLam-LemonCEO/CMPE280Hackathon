import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "../ThemeContext";

const PROFILE_PICTURE_KEY_PREFIX = "userProfilePictureV1";
const UPLOAD_STORAGE_KEY_PREFIX = "userGalleryUploadsV1";

const normalizeEmail = (email) => email.trim().toLowerCase();

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser"));
  } catch {
    return null;
  }
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem("users")) || [];
  } catch {
    return [];
  }
}

function getProfilePictureKey(email) {
  const safeEmail = email?.trim()?.toLowerCase() || "guest";
  return `${PROFILE_PICTURE_KEY_PREFIX}:${safeEmail}`;
}

function getUploadsKey(email) {
  const safeEmail = email?.trim()?.toLowerCase() || "guest";
  return `${UPLOAD_STORAGE_KEY_PREFIX}:${safeEmail}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

export default function UserProfile() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getCurrentUser());

  const [profileImage, setProfileImage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  useEffect(() => {
    const storedUser = getCurrentUser();
    if (!storedUser) {
      navigate("/auth?mode=login");
      return;
    }

    setCurrentUser(storedUser);
    setNewEmail(storedUser.email || "");

    const storedProfileImage = localStorage.getItem(
      getProfilePictureKey(storedUser.email),
    );
    if (storedProfileImage) {
      setProfileImage(storedProfileImage);
    }
  }, [navigate]);

  const isDeleteMatch = useMemo(
    () => deleteText.trim().toLowerCase() === "delete account",
    [deleteText],
  );

  const handleSaveProfileImage = async () => {
    if (!selectedFile || !currentUser?.email) return;

    try {
      const dataUrl = await readFileAsDataUrl(selectedFile);
      localStorage.setItem(getProfilePictureKey(currentUser.email), dataUrl);
      setProfileImage(dataUrl);
      setSelectedFile(null);
      alert("Profile picture updated.");
    } catch {
      alert("Could not upload profile picture.");
    }
  };

  const handleDeleteProfilePhoto = () => {
    if (!currentUser?.email) return;

    const key = getProfilePictureKey(currentUser.email);
    localStorage.removeItem(key);
    setProfileImage("");
    setSelectedFile(null);

    alert("Profile photo removed.");
  };

  const handleChangeEmail = () => {
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

    if (!currentUser?.email) return;

    if (trimmedEmail === normalizeEmail(currentUser.email)) {
      setShowEmailModal(false);
      return;
    }

    const users = getUsers();
    const currentNormalized = normalizeEmail(currentUser.email);
    const emailExists = users.some(
      (user) =>
        normalizeEmail(user.email) === trimmedEmail &&
        normalizeEmail(user.email) !== currentNormalized,
    );

    if (emailExists) {
      alert("That email is already registered.");
      return;
    }

    const oldEmail = currentNormalized;
    const oldProfileKey = getProfilePictureKey(oldEmail);
    const newProfileKey = getProfilePictureKey(trimmedEmail);
    const oldUploadsKey = getUploadsKey(oldEmail);
    const newUploadsKey = getUploadsKey(trimmedEmail);

    const updatedUsers = users.map((user) => {
      if (normalizeEmail(user.email) === oldEmail) {
        return { ...user, email: trimmedEmail };
      }
      return user;
    });

    const updatedCurrentUser = {
      ...currentUser,
      email: trimmedEmail,
    };

    const oldProfileImage = localStorage.getItem(oldProfileKey);
    if (oldProfileImage) {
      localStorage.setItem(newProfileKey, oldProfileImage);
      localStorage.removeItem(oldProfileKey);
    }

    const oldUploads = localStorage.getItem(oldUploadsKey);
    if (oldUploads) {
      localStorage.setItem(newUploadsKey, oldUploads);
      localStorage.removeItem(oldUploadsKey);
    }

    localStorage.setItem("users", JSON.stringify(updatedUsers));
    localStorage.setItem("currentUser", JSON.stringify(updatedCurrentUser));

    setCurrentUser(updatedCurrentUser);
    setShowEmailModal(false);

    alert("Email changed successfully.");
  };

  const handleChangePassword = () => {
    if (
      !oldPassword.trim() ||
      !newPassword.trim() ||
      !confirmNewPassword.trim()
    ) {
      alert("Please fill in all password fields.");
      return;
    }

    if (oldPassword !== currentUser?.password) {
      alert("Old password is incorrect.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      alert("New passwords do not match.");
      return;
    }

    if (newPassword.length < 4) {
      alert("New password should be at least 4 characters.");
      return;
    }

    if (newPassword === oldPassword) {
      alert("New password must be different from the old password.");
      return;
    }

    const users = getUsers();
    const updatedUsers = users.map((user) => {
      if (user.email === currentUser.email) {
        return {
          ...user,
          password: newPassword,
        };
      }
      return user;
    });

    const updatedCurrentUser = {
      ...currentUser,
      password: newPassword,
    };

    localStorage.setItem("users", JSON.stringify(updatedUsers));
    localStorage.setItem("currentUser", JSON.stringify(updatedCurrentUser));

    setCurrentUser(updatedCurrentUser);
    setOldPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowPasswordModal(false);

    alert("Password changed successfully.");
  };

  const handleDeleteAccount = () => {
    if (!isDeleteMatch || !currentUser?.email) return;

    const users = getUsers();
    const filteredUsers = users.filter(
      (user) => user.email !== currentUser.email,
    );

    localStorage.setItem("users", JSON.stringify(filteredUsers));
    localStorage.removeItem("currentUser");
    localStorage.removeItem(getProfilePictureKey(currentUser.email));
    localStorage.removeItem(getUploadsKey(currentUser.email));

    navigate("/");
  };

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
              Update your profile image, email, password, or remove your
              account.
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
                  {currentUser?.email?.[0]?.toUpperCase() || "U"}
                </div>
              )}

              <h2 className="mt-5 break-all text-center text-xl font-bold text-[#0f172f] dark:text-white">
                {currentUser?.email || "User"}
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
                className="mt-4 w-full btn-primary"
              >
                Save Profile Picture
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
                Account Details
              </h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-[#f8fafc] dark:bg-slate-800 px-4 py-3">
                  <p className="text-sm text-[#64748b] dark:text-slate-400">
                    Email
                  </p>
                  <p className="mt-1 break-all font-semibold text-[#0f172f] dark:text-white">
                    {currentUser?.email || "No email"}
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
                  setNewEmail(currentUser?.email || "");
                }}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button onClick={handleChangeEmail} className="btn-primary-sm">
                Change
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
              Enter your old password and choose a new one.
            </p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Old Password
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(event) => setOldPassword(event.target.value)}
                  className="form-input-modal"
                />
              </label>
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
                  setOldPassword("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                }}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button onClick={handleChangePassword} className="btn-primary-sm">
                Change
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
