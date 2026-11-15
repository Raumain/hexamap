import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link, Navigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '../components/button';
import { FormError } from '../components/form-error';
import { TextField } from '../components/text-field';
import { signUp } from '../lib/auth';
import { useInvalidateSession, useSession } from '../lib/session';

export const Route = createFileRoute('/register')({
  component: RegisterPage,
});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RegisterPage() {
  const router = useRouter();
  const session = useSession();
  const invalidateSession = useInvalidateSession();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { pseudo: '', email: '', password: '', confirmPassword: '' },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const { error } = await signUp.email({
        email: value.email,
        password: value.password,
        name: value.pseudo,
        pseudo: value.pseudo,
      });
      if (error) {
        if (error.status === 422 || error.code === 'USER_ALREADY_EXISTS') {
          setFormError('Un compte existe déjà avec cette adresse e-mail.');
        } else {
          setFormError("L'inscription a échoué. Veuillez réessayer.");
        }
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
        <h1 className="text-3xl font-bold tracking-tight">Inscription</h1>
        <p className="text-slate-400">Rejoignez Hexamap et commencez votre collection.</p>
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
          name="pseudo"
          validators={{
            onChange: ({ value }) => {
              if (!value) return 'Pseudo requis.';
              if (value.length < 3 || value.length > 20)
                return 'Le pseudo doit contenir entre 3 et 20 caractères.';
              return undefined;
            },
          }}
        >
          {(field) => (
            <TextField
              label="Pseudo"
              type="text"
              autoComplete="username"
              required
              error={field.state.meta.errors.find((e) => typeof e === 'string')}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>

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
              autoComplete="new-password"
              required
              error={field.state.meta.errors.find((e) => typeof e === 'string')}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>

        <form.Field
          name="confirmPassword"
          validators={{
            onChangeListenTo: ['password'],
            onChange: ({ value, fieldApi }) => {
              if (!value) return 'Confirmation du mot de passe requise.';
              if (value !== fieldApi.form.state.values.password)
                return 'Les mots de passe ne correspondent pas.';
              return undefined;
            },
          }}
        >
          {(field) => (
            <TextField
              label="Confirmation du mot de passe"
              type="password"
              autoComplete="new-password"
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
              S'inscrire
            </Button>
          )}
        </form.Subscribe>
      </form>

      <p className="text-sm text-slate-400">
        Vous avez déjà un compte ?{' '}
        <Link to="/login" className="text-amber-400 hover:underline">
          Se connecter
        </Link>
      </p>
    </section>
  );
}
