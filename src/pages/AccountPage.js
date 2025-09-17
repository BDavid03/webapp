import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import "./AccountPage.css";

function keyFor(user) {
  return user?.id ? `profile_${user.id}` : "profile_v1";
}

export default function AccountPage() {
  const { logout, currentUser } = useAuth();
  const [profile, setProfile] = useState({ displayName: "", avatarDataUrl: "" });
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const initialRef = useRef({ displayName: "", avatarDataUrl: "" });

  // Load from localStorage once
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(keyFor(currentUser)) || "{}");
      const next = { displayName: saved.displayName || "", avatarDataUrl: saved.avatarDataUrl || "" };
      setProfile(next);
      setPreview(next.avatarDataUrl || "");
      initialRef.current = next;
    } catch (_) {
      // ignore
    }
  }, [currentUser?.id]);

  const dirty = useMemo(() => {
    return (
      (profile.displayName || "") !== (initialRef.current.displayName || "") ||
      (profile.avatarDataUrl || "") !== (initialRef.current.avatarDataUrl || "")
    );
  }, [profile]);

  function save(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    const name = (profile.displayName || "").trim();
    if (name.length === 0) {
      setError("Please enter a display name.");
      return;
    }
    const next = { ...profile, displayName: name };
    try {
      localStorage.setItem(keyFor(currentUser), JSON.stringify(next));
      initialRef.current = next;
      setProfile(next);
      setMessage("Saved");
      setTimeout(() => setMessage(""), 1200);
    } catch (err) {
      setError("Failed to save to localStorage.");
    }
  }

  function resetToSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(keyFor(currentUser)) || "{}");
      const next = { displayName: saved.displayName || "", avatarDataUrl: saved.avatarDataUrl || "" };
      setProfile(next);
      setPreview(next.avatarDataUrl || "");
      initialRef.current = next;
      setError("");
      setMessage("");
    } catch (_) {}
  }

  function onAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    // Optional size hint (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage("");
      setError("Image is large; it will be downscaled.");
    } else {
      setError("");
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      // Downscale to square preview (max 256x256)
      const img = new Image();
      img.onload = () => {
        try {
          const side = Math.min(img.width, img.height);
          const sx = Math.floor((img.width - side) / 2);
          const sy = Math.floor((img.height - side) / 2);
          const outSize = 256;
          const canvas = document.createElement("canvas");
          canvas.width = outSize;
          canvas.height = outSize;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, sx, sy, side, side, 0, 0, outSize, outSize);
          const outUrl = canvas.toDataURL("image/png");
          setProfile((p) => ({ ...p, avatarDataUrl: outUrl }));
          setPreview(outUrl);
        } catch (_) {
          // Fallback to original if canvas fails
          setProfile((p) => ({ ...p, avatarDataUrl: dataUrl }));
          setPreview(dataUrl);
        }
      };
      img.onerror = () => {
        setError("Could not load selected image.");
      };
      img.src = dataUrl;
    };
    reader.onerror = () => setError("Could not read selected file.");
    reader.readAsDataURL(file);
  }

  function clearAvatar() {
    setProfile((p) => ({ ...p, avatarDataUrl: "" }));
    setPreview("");
  }

  return (
    <section className="account">
      <h1>Account</h1>

      <form className="account__form" onSubmit={save}>
        <label className="account__row">
          <span>Display name</span>
          <input
            type="text"
            value={profile.displayName}
            onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
            placeholder="Your name"
            maxLength={60}
          />
        </label>

        <label className="account__row">
          <span>Avatar</span>
          <input type="file" accept="image/*" onChange={onAvatarChange} />
        </label>

        {preview ? (
          <div className="account__avatar-preview">
            <img src={preview} alt="Avatar preview" />
            <div>
              <button type="button" onClick={clearAvatar}>Remove avatar</button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="account__message account__message--err">{error}</div>
        ) : null}
        {message ? (
          <div className="account__message account__message--ok">{message}</div>
        ) : null}

        <div className="account__actions">
          <button type="submit" disabled={!dirty}>Save</button>
          <button type="button" onClick={resetToSaved} disabled={!dirty}>Reset</button>
          <button type="button" onClick={logout}>Log out</button>
        </div>
      </form>
    </section>
  );
}

