import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link, Navigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '../components/button';
import { FormError } from '../components/form-error';
import { TextField } from '../components/text-field';
import { signIn } from '../lib/auth';
import { useInvalidateSession, useSession } from '../lib/session';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginPage() {
  const router = useRouter();
  const session = useSession();
  const invalidateSession = useInvalidateSession();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const { error } = await signIn.email({
        email: value.email,
        password: value.password,
      });
      if (error) {
        setFormError('Adresse e-mail ou mot de passe incorrect.');
        return;
      }
      invalidateSession();
      await router.navigate({ to: '/' });
    },
  });

  if (session.data?.user) {
    return <Navigate to="/" />;
  }

  return (
    <section className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Connexion</h1>
        <p className="text-slate-400">Accédez à votre collection et à vos tickets.</p>
      </div>

      <FormError message={formError} />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-6"
      >
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) => {
              if (!value) return 'Adresse e-mail requise.';
              if (!emailRegex.test(value)) return 'Adresse e-mail invalide.';
              return undefined;
            },
          }}
        >
          {(field) => (
            <TextField
              label="Adresse e-mail"
              type="email"
              autoComplete="email"
              required
              error={field.state.meta.errors.find((e) => typeof e === 'string')}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onChange: ({ value }) => {
              if (!value) return 'Mot de passe requis.';
              if (value.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
              return undefined;
            },
          }}
        >
          {(field) => (
            <TextField
              label="Mot de passe"
              type="password"
              autoComplete="current-password"
              required
              error={field.state.meta.errors.find((e) => typeof e === 'string')}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>

        <form.Subscribe
          selector={(s) => ({ isSubmitting: s.isSubmitting, canSubmit: s.canSubmit })}
        >
          {({ isSubmitting, canSubmit }) => (
            <Button type="submit" isPending={isSubmitting} disabled={!canSubmit} className="w-full">
              Se connecter
            </Button>
          )}
        </form.Subscribe>
      </form>

      <p className="text-sm text-slate-400">
        Pas encore de compte ?{' '}
        <Link to="/register" className="text-amber-400 hover:underline">
          Créer un compte
        </Link>
      </p>
    </section>
  );
}
