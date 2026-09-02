'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Camera, LoaderCircle, Trash2, X } from 'lucide-react';
import { uploadStudioMedia } from '@/lib/studio/media-upload';
import { MAX_BIO_LENGTH, MAX_DISPLAY_NAME_LENGTH } from '@/lib/profiles-shared';
import { avatarStyle, initials } from '@/app/components/media';
import type { Profile } from '@/lib/types';
import { useT } from '@/app/components/i18n-provider';

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
  const t = useT();
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
        throw new Error(t('profile.avatarNotImage'));
      }
      setAvatarUrl(uploaded.url);
      setAvatarMediaId(uploaded.id);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : t('profile.avatarFailed'),
      );
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const name = displayName.replace(/\s+/g, ' ').trim();
    if (!name) {
      setError(t('profile.nameEmpty'));
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
        throw new Error(payload.error || t('profile.saveFailed'));
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
          : t('profile.saveFailed'),
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
      className="fdlg-modal"
      aria-labelledby="fdlg-title"
      onClick={closeFromBackdrop}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        className="fdlg-card"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <header className="fdlg-head">
          <h2 id="fdlg-title">{t('profile.edit')}</h2>
          <button
            type="button"
            className="fdlg-close"
            onClick={onClose}
            disabled={busy}
            aria-label={t('common.close')}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="fdlg-body">
          <div className="fdlg-avatar-row">
            <span
              className="fdlg-avatar"
              style={avatarStyle(profile.avatar_color, avatarUrl)}
            >
              {initials(displayName || profile.display_name)}
              <button
                type="button"
                className="fdlg-avatar-btn"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                aria-label={t('profile.photoUpload')}
                title={t('profile.photoUpload')}
              >
                {uploading ? (
                  <LoaderCircle className="fdlg-spin" aria-hidden="true" />
                ) : (
                  <Camera aria-hidden="true" />
                )}
              </button>
            </span>
            <div className="fdlg-avatar-copy">
              <b>{t('profile.photo')}</b>
              <small>{t('profile.photoLead')}</small>
              {avatarMediaId ? (
                <button
                  type="button"
                  className="fdlg-remove"
                  onClick={() => {
                    setAvatarMediaId(null);
                    setAvatarUrl(null);
                  }}
                  disabled={busy}
                >
                  <Trash2 aria-hidden="true" />
                  {t('profile.photoRemove')}
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

          <div className="fdlg-fld">
            <div className="fdlg-label-row">
              <label htmlFor="fdlg-name">{t('profile.displayName')}</label>
              <span className="tabular-nums">
                {displayName.length}/{MAX_DISPLAY_NAME_LENGTH}
              </span>
            </div>
            <input
              id="fdlg-name"
              value={displayName}
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={t('profile.displayNamePlaceholder')}
              disabled={busy}
              required
              autoFocus
            />
          </div>

          <div className="fdlg-fld">
            <div className="fdlg-label-row">
              <label htmlFor="fdlg-bio">
                {t('profile.bio')} <small>{t('common.optional')}</small>
              </label>
              <span className="tabular-nums">
                {bio.length}/{MAX_BIO_LENGTH}
              </span>
            </div>
            <textarea
              id="fdlg-bio"
              value={bio}
              rows={4}
              maxLength={MAX_BIO_LENGTH}
              onChange={(event) => setBio(event.target.value)}
              placeholder={t('profile.bioPlaceholder')}
              disabled={busy}
            />
          </div>

          <p className="fdlg-static">
            {t('profile.handleNote', { handle: profile.handle ?? '' })}
          </p>

          {error ? (
            <p className="fdlg-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="fdlg-foot">
          <button
            type="button"
            className="fdlg-ghost"
            onClick={onClose}
            disabled={busy}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="fdlg-save"
            disabled={busy || !displayName.trim()}
          >
            {saving && <LoaderCircle className="fdlg-spin" aria-hidden="true" />}
            {saving ? t('common.saving') : t('profile.saveChanges')}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
