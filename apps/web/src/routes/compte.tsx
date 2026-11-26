import { PSEUDO_MAX_LENGTH, pseudoErrorMessage, validatePseudo } from '@hexamap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Navigate, useRouter } from '@tanstack/react-router';
import { type ReactNode, useId, useState } from 'react';
import { Button } from '../components/button';
import { FormError } from '../components/form-error';
import { PushOptin } from '../components/push/push-optin';
import { TextField } from '../components/text-field';
import { outlineButtonClass } from '../components/ui/button-classes';
import { SessionUnavailable } from '../components/ui/session-unavailable';
import {
  ACCOUNT_BIO_MAX_LENGTH,
  ACCOUNT_PASSWORD_MIN_LENGTH,
  ACCOUNT_ROOM,
} from '../content/account';
import { PUSH_ROOM } from '../content/push';
import {
  accountCapabilitiesQueryOptions,
  accountErrorMessageOf,
  accountProfileQueryKey,
  accountProfileQueryOptions,
  changePassword,
  deleteAccount,
  requestEmailChange,
  saveAccountProfile,
  updatePseudo,
} from '../lib/account';
import type { SessionUser } from '../lib/auth';
import { useInvalidateSession, useSessionState } from '../lib/session';

export const Route = createFileRoute('/compte')({
  component: AccountPage,
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Notice {
  readonly tone: 'success' | 'error';
  readonly message: string;
}

function AccountPage() {
  const session = useSessionState();

  if (session.status === 'loading') {
    return <p className="text-sm text-vellum/70">{ACCOUNT_ROOM.loadingSession}</p>;
  }

  if (session.status === 'unavailable') {
    return <SessionUnavailable onRetry={session.retry} />;
  }

  if (session.status === 'anonymous') {
    return <Navigate to="/login" />;
  }

  return <AccountRoom user={session.user} />;
}

/**
 * Le corps de la salle, monté seulement une fois la session établie : la lecture
 * des capacités est un hook, et un hook ne se place jamais après un retour
 * anticipé.
 */
function AccountRoom({ user }: { user: SessionUser }) {
  const pseudo = user.pseudo ?? user.name;
  // La confirmation demande le pseudo **de la base**, jamais le repli `name` :
  // le serveur compare à `user.pseudo`, et un pseudo absent ne peut pas être
  // recopié.
  const confirmationPseudo = user.pseudo ?? '';
  const capabilities = useQuery(accountCapabilitiesQueryOptions());
  const deletionOpen = capabilities.data?.deletion === true;

  return (
    <section>
      <header>
        <p className="salon-eyebrow">{ACCOUNT_ROOM.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {ACCOUNT_ROOM.title}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-vellum/70">
          {ACCOUNT_ROOM.subtitle}
        </p>
      </header>

      <div className="mt-8 space-y-6">
        <IdentitySection currentPseudo={pseudo} />
        <EmailSection user={user} />
        <PasswordSection />
        <ProfileSection />
        <AccountSection title={PUSH_ROOM.title} description={PUSH_ROOM.description}>
          <PushOptin />
        </AccountSection>
        <ExportSection />
        {deletionOpen && confirmationPseudo.length > 0 ? (
          <DangerSection pseudo={confirmationPseudo} />
        ) : (
          <p className="px-1 font-mono text-[11px] leading-relaxed text-vellum/55">
            {ACCOUNT_ROOM.danger.closed}
          </p>
        )}
      </div>
    </section>
  );
}

interface AccountSectionProps {
  title: string;
  description: string;
  children: ReactNode;
  danger?: boolean;
}

function AccountSection({ title, description, children, danger = false }: AccountSectionProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-sheet border p-5 md:p-6 ${
        danger ? 'border-oxide/45 bg-cabinet-raised' : 'border-veil bg-cabinet-raised'
      }`}
    >
      <h2
        id={headingId}
        className={`font-display text-xl font-semibold ${danger ? 'text-oxide' : 'text-vellum'}`}
      >
        {title}
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-vellum/70">{description}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function CurrentValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2px] border border-veil/70 bg-cabinet-sunk px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/55">{label}</p>
      <p className="mt-1 break-words text-[15px] text-vellum">{value}</p>
    </div>
  );
}

/** Les messages sont annoncés : `alert` pour un refus, `status` pour un succès. */
function NoticeLine({ notice }: { notice: Notice | null }) {
  if (!notice) return null;

  if (notice.tone === 'error') {
    return <FormError message={notice.message} />;
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className="rounded-[2px] border border-verdigris/45 bg-verdigris/10 px-3 py-2 font-mono text-[11px] leading-relaxed text-verdigris"
    >
      {notice.message}
    </p>
  );
}

function IdentitySection({ currentPseudo }: { currentPseudo: string }) {
  const [value, setValue] = useState(currentPseudo);
  const [notice, setNotice] = useState<Notice | null>(null);
  const invalidateSession = useInvalidateSession();

  const validation = validatePseudo(value);
  const unchanged = value.trim() === currentPseudo;
  const liveError =
    value.trim().length > 0 && !validation.ok ? pseudoErrorMessage(validation.problem) : undefined;
  const canSubmit = validation.ok && !unchanged;

  const mutation = useMutation({
    mutationFn: (pseudo: string) => updatePseudo(pseudo),
    onSuccess: (pseudo) => {
      setValue(pseudo);
      setNotice({ tone: 'success', message: ACCOUNT_ROOM.identity.success });
      void invalidateSession();
    },
    onError: (error) => setNotice({ tone: 'error', message: accountErrorMessageOf(error) }),
  });

  return (
    <AccountSection
      title={ACCOUNT_ROOM.identity.title}
      description={ACCOUNT_ROOM.identity.description}
    >
      <CurrentValue label={ACCOUNT_ROOM.identity.currentLabel} value={currentPseudo} />

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(null);
          if (!validation.ok) return;
          mutation.mutate(validation.pseudo);
        }}
        className="space-y-4"
      >
        <TextField
          tone="dark"
          label={ACCOUNT_ROOM.identity.label}
          placeholder={ACCOUNT_ROOM.identity.placeholder}
          autoComplete="username"
          maxLength={PSEUDO_MAX_LENGTH}
          value={value}
          error={liveError}
          onChange={(event) => setValue(event.target.value)}
        />
        <p className="text-sm leading-relaxed text-vellum/60">
          {unchanged ? ACCOUNT_ROOM.identity.unchanged : ACCOUNT_ROOM.identity.hint}
        </p>

        <NoticeLine notice={notice} />

        <Button type="submit" size="sm" isPending={mutation.isPending} disabled={!canSubmit}>
          {ACCOUNT_ROOM.identity.submit}
        </Button>
      </form>
    </AccountSection>
  );
}

function EmailSection({ user }: { user: SessionUser }) {
  const [value, setValue] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const invalidateSession = useInvalidateSession();

  const trimmed = value.trim();
  const liveError =
    trimmed.length > 0 && !EMAIL_PATTERN.test(trimmed) ? ACCOUNT_ROOM.email.invalid : undefined;
  // Le champ reste éditable en permanence : aucune confirmation d'adresse n'est
  // demandée, donc rien ne ferme le formulaire et rien ne le bloque.
  const canSubmit = trimmed.length > 0 && EMAIL_PATTERN.test(trimmed);

  const mutation = useMutation({
    mutationFn: (newEmail: string) => requestEmailChange(newEmail),
    onSuccess: () => {
      setValue('');
      setNotice({ tone: 'success', message: ACCOUNT_ROOM.email.success });
      void invalidateSession();
    },
    onError: (error) => setNotice({ tone: 'error', message: accountErrorMessageOf(error) }),
  });

  return (
    <AccountSection title={ACCOUNT_ROOM.email.title} description={ACCOUNT_ROOM.email.description}>
      <CurrentValue label={ACCOUNT_ROOM.email.currentLabel} value={user.email} />

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(null);
          if (!canSubmit) return;
          mutation.mutate(trimmed);
        }}
        className="space-y-4"
      >
        <TextField
          tone="dark"
          type="email"
          label={ACCOUNT_ROOM.email.label}
          placeholder={ACCOUNT_ROOM.email.placeholder}
          autoComplete="email"
          value={value}
          error={liveError}
          onChange={(event) => setValue(event.target.value)}
        />

        <NoticeLine notice={notice} />

        <Button type="submit" size="sm" isPending={mutation.isPending} disabled={!canSubmit}>
          {ACCOUNT_ROOM.email.submit}
        </Button>
      </form>
    </AccountSection>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  const tooShort = newPassword.length > 0 && newPassword.length < ACCOUNT_PASSWORD_MIN_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== newPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= ACCOUNT_PASSWORD_MIN_LENGTH &&
    confirmation === newPassword;

  const mutation = useMutation({
    mutationFn: () =>
      changePassword({
        currentPassword,
        newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setNotice({ tone: 'success', message: ACCOUNT_ROOM.password.success });
    },
    onError: (error) => setNotice({ tone: 'error', message: accountErrorMessageOf(error) }),
  });

  return (
    <AccountSection
      title={ACCOUNT_ROOM.password.title}
      description={ACCOUNT_ROOM.password.description}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(null);

          // Le mot de passe actuel est refusé ici comme sur le serveur : pas de
          // requête pour apprendre ce que le formulaire sait déjà.
          if (currentPassword.length === 0) {
            setNotice({ tone: 'error', message: ACCOUNT_ROOM.password.currentRequired });
            return;
          }
          if (newPassword.length < ACCOUNT_PASSWORD_MIN_LENGTH) {
            setNotice({ tone: 'error', message: ACCOUNT_ROOM.password.tooShort });
            return;
          }
          if (newPassword !== confirmation) {
            setNotice({ tone: 'error', message: ACCOUNT_ROOM.password.mismatch });
            return;
          }

          mutation.mutate();
        }}
        className="space-y-4"
      >
        <TextField
          tone="dark"
          type="password"
          label={ACCOUNT_ROOM.password.currentLabel}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <TextField
          tone="dark"
          type="password"
          label={ACCOUNT_ROOM.password.newLabel}
          autoComplete="new-password"
          value={newPassword}
          error={tooShort ? ACCOUNT_ROOM.password.tooShort : undefined}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <TextField
          tone="dark"
          type="password"
          label={ACCOUNT_ROOM.password.confirmLabel}
          autoComplete="new-password"
          value={confirmation}
          error={mismatch ? ACCOUNT_ROOM.password.mismatch : undefined}
          onChange={(event) => setConfirmation(event.target.value)}
        />

        <NoticeLine notice={notice} />

        <Button type="submit" size="sm" isPending={mutation.isPending} disabled={!canSubmit}>
          {ACCOUNT_ROOM.password.submit}
        </Button>
      </form>
    </AccountSection>
  );
}

function ProfileSection() {
  const query = useQuery(accountProfileQueryOptions());

  return (
    <AccountSection
      title={ACCOUNT_ROOM.profile.title}
      description={ACCOUNT_ROOM.profile.description}
    >
      {query.isPending ? (
        <p className="text-sm text-vellum/70">{ACCOUNT_ROOM.profile.loading}</p>
      ) : query.isError ? (
        <div className="space-y-4">
          <FormError message={accountErrorMessageOf(query.error)} />
          <button type="button" className={outlineButtonClass} onClick={() => void query.refetch()}>
            {ACCOUNT_ROOM.retry}
          </button>
        </div>
      ) : (
        <ProfileForm bio={query.data.bio} profilePublic={query.data.profilePublic} />
      )}
    </AccountSection>
  );
}

interface ProfileFormProps {
  bio: string | null;
  profilePublic: boolean;
}

function ProfileForm({ bio, profilePublic }: ProfileFormProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(bio ?? '');
  const [isPublic, setIsPublic] = useState(profilePublic);
  const [notice, setNotice] = useState<Notice | null>(null);
  const bioFieldId = useId();

  const mutation = useMutation({
    mutationFn: () =>
      saveAccountProfile({
        bio: value.trim() || null,
        profilePublic: isPublic,
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountProfileQueryKey, profile);
      setNotice({ tone: 'success', message: ACCOUNT_ROOM.profile.success });
    },
    onError: (error) => setNotice({ tone: 'error', message: accountErrorMessageOf(error) }),
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setNotice(null);
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <div>
        <label
          htmlFor={bioFieldId}
          className="block font-mono text-[10px] uppercase tracking-[0.18em] text-vellum/65"
        >
          {ACCOUNT_ROOM.profile.bioLabel}
        </label>
        <textarea
          id={bioFieldId}
          rows={4}
          maxLength={ACCOUNT_BIO_MAX_LENGTH}
          value={value}
          placeholder={ACCOUNT_ROOM.profile.bioPlaceholder}
          onChange={(event) => setValue(event.target.value)}
          className="mt-1.5 w-full rounded-[2px] border border-veil bg-cabinet-sunk px-3 py-2 text-[15px] leading-relaxed text-vellum outline-none transition-colors duration-150 placeholder:text-vellum/55 focus:border-brass focus:ring-2 focus:ring-brass/25"
        />
        <p className="mt-1.5 flex items-baseline justify-between gap-3 font-mono text-[10px] tabular-nums text-vellum/55">
          <span>{ACCOUNT_ROOM.profile.bioHint}</span>
          <span>
            {value.length} / {ACCOUNT_BIO_MAX_LENGTH}
          </span>
        </p>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-brass"
        />
        <span className="min-w-0">
          <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-vellum/65">
            {ACCOUNT_ROOM.profile.publicLabel}
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-vellum/60">
            {ACCOUNT_ROOM.profile.publicHint}
          </span>
        </span>
      </label>

      <NoticeLine notice={notice} />

      <Button type="submit" size="sm" isPending={mutation.isPending}>
        {ACCOUNT_ROOM.profile.submit}
      </Button>
    </form>
  );
}

function ExportSection() {
  return (
    <AccountSection title={ACCOUNT_ROOM.export.title} description={ACCOUNT_ROOM.export.description}>
      {/* Même origine, cookies inclus : un lien de téléchargement suffit. */}
      <a href="/api/v1/account/export" download className={outlineButtonClass}>
        {ACCOUNT_ROOM.export.submit}
      </a>
      <p className="text-sm leading-relaxed text-vellum/60">{ACCOUNT_ROOM.export.hint}</p>
    </AccountSection>
  );
}

function DangerSection({ pseudo }: { pseudo: string }) {
  const router = useRouter();
  const invalidateSession = useInvalidateSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      deleteAccount({
        password,
        confirmation: confirmation.trim(),
      }),
    onSuccess: async () => {
      setNotice({ tone: 'success', message: ACCOUNT_ROOM.danger.success });
      await invalidateSession();
      await router.navigate({ to: '/' });
    },
    onError: (error) => setNotice({ tone: 'error', message: accountErrorMessageOf(error) }),
  });

  return (
    <AccountSection
      title={ACCOUNT_ROOM.danger.title}
      description={ACCOUNT_ROOM.danger.description}
      danger
    >
      <p
        role="note"
        className="rounded-[2px] border border-oxide/45 bg-oxide/10 px-3 py-2 font-mono text-[11px] leading-relaxed text-oxide"
      >
        {ACCOUNT_ROOM.danger.warning}
      </p>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(null);

          if (password.length === 0) {
            setNotice({ tone: 'error', message: ACCOUNT_ROOM.danger.passwordRequired });
            return;
          }
          if (confirmation.trim().length === 0) {
            setNotice({ tone: 'error', message: ACCOUNT_ROOM.danger.confirmationRequired });
            return;
          }
          if (confirmation.trim() !== pseudo) {
            setNotice({ tone: 'error', message: ACCOUNT_ROOM.danger.mismatch });
            return;
          }

          mutation.mutate();
        }}
        className="space-y-4"
      >
        <TextField
          tone="dark"
          type="password"
          label={ACCOUNT_ROOM.danger.passwordLabel}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <TextField
          tone="dark"
          type="text"
          label={ACCOUNT_ROOM.danger.confirmationLabel}
          placeholder={ACCOUNT_ROOM.danger.confirmationPlaceholder}
          autoComplete="off"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <p className="text-sm leading-relaxed text-vellum/60">
          {ACCOUNT_ROOM.danger.confirmationHint}
        </p>

        <NoticeLine notice={notice} />

        <Button type="submit" size="sm" variant="danger" isPending={mutation.isPending}>
          {ACCOUNT_ROOM.danger.submit}
        </Button>
      </form>
    </AccountSection>
  );
}
