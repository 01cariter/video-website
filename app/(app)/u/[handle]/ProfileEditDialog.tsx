'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Camera, LoaderCircle, Trash2, X } from 'lucide-react';
import { uploadStudioMedia } from '@/lib/studio/media-upload';
import { MAX_BIO_LENGTH, MAX_DISPLAY_NAME_LENGTH } from '@/lib/profiles-shared';
import { avatarStyle, initials } from '@/app/components/media';
import type { Profile } from '@/lib/types';

export interface ProfileEdits {
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  avatar_media_id: number | null;
}

export default function ProfileEditDialog({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved: (edits: ProfileEdits) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [avatarMediaId, setAvatarMediaId] = useState(profile.avatar_media_id);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = uploading || saving;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  async function pickAvatar(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = await uploadStudioMedia(file);
      if (uploaded.kind !== 'image') {
        throw new Error('Choose an image for your avatar.');
      }
      setAvatarUrl(uploaded.url);
      setAvatarMediaId(uploaded.id);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'That image could not be uploaded.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const name = displayName.replace(/\s+/g, ' ').trim();
    if (!name) {
      setError('Your display name cannot be empty.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: name,
          bio: bio.trim(),
          avatarMediaId,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || 'Your profile could not be saved.');
      }
      onSaved({
        display_name: name,
        bio: bio.trim() || null,
        avatar_url: avatarMediaId ? avatarUrl : null,
        avatar_media_id: avatarMediaId,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Your profile could not be saved.',
      );
      setSaving(false);
    }
  }

  function closeFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (!busy && event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="pfe-modal"
      aria-labelledby="pfe-title"
      onClick={closeFromBackdrop}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        className="pfe-card"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <header className="pfe-head">
          <h2 id="pfe-title">Edit profile</h2>
          <button
            type="button"
            className="pfe-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="pfe-body">
          <div className="pfe-avatar-row">
            <span
              className="pfe-avatar"
              style={avatarStyle(profile.avatar_color, avatarUrl)}
            >
              {initials(displayName || profile.display_name)}
              <button
                type="button"
                className="pfe-avatar-btn"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                aria-label="Upload a new avatar"
                title="Upload a new avatar"
              >
                {uploading ? (
                  <LoaderCircle className="pfe-spin" aria-hidden="true" />
                ) : (
                  <Camera aria-hidden="true" />
                )}
              </button>
            </span>
            <div className="pfe-avatar-copy">
              <b>Profile photo</b>
              <small>JPEG, PNG, WebP or GIF · square images look best.</small>
              {avatarMediaId ? (
                <button
                  type="button"
                  className="pfe-remove"
                  onClick={() => {
                    setAvatarMediaId(null);
                    setAvatarUrl(null);
                  }}
                  disabled={busy}
                >
                  <Trash2 aria-hidden="true" />
                  Remove photo
                </button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="image/*"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void pickAvatar(file);
              }}
            />
          </div>

          <div className="pfe-fld">
            <div className="pfe-label-row">
              <label htmlFor="pfe-name">Display name</label>
              <span className="tabular-nums">
                {displayName.length}/{MAX_DISPLAY_NAME_LENGTH}
              </span>
            </div>
            <input
              id="pfe-name"
              value={displayName}
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="How your name appears on posts"
              disabled={busy}
              required
              autoFocus
            />
          </div>

          <div className="pfe-fld">
            <div className="pfe-label-row">
              <label htmlFor="pfe-bio">
                Bio <small>optional</small>
              </label>
              <span className="tabular-nums">
                {bio.length}/{MAX_BIO_LENGTH}
              </span>
            </div>
            <textarea
              id="pfe-bio"
              value={bio}
              rows={4}
              maxLength={MAX_BIO_LENGTH}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Tell people what you create."
              disabled={busy}
            />
          </div>

          <p className="pfe-static">
            Handle <b>{profile.handle}</b> — permanent, so links keep working.
          </p>

          {error ? (
            <p className="pfe-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="pfe-foot">
          <button
            type="button"
            className="pfe-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="pfe-save"
            disabled={busy || !displayName.trim()}
          >
            {saving && <LoaderCircle className="pfe-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
