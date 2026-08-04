import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn, useAuth } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { BuildOrderForm } from '@/components/BuildOrderForm';
import { createBuildOrder, type BuildOrderInput } from '@/lib/api';

export function NewPage() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <NewBuildOrderForm />
      </SignedIn>
    </>
  );
}

function NewBuildOrderForm() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(input: BuildOrderInput) {
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      const created = await createBuildOrder(input, token);
      toast.success('Build order créé');
      navigate(`/build/${created.id}`);
    } catch (error) {
      toast.error('Création impossible', {
        description: error instanceof Error ? error.message : undefined,
      });
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Créer un build order</h1>
        <p className="text-muted-foreground">Décrivez les phases et actions clés.</p>
      </div>
      <BuildOrderForm submitLabel="Créer" submitting={submitting} onSubmit={handleSubmit} />
    </div>
  );
}
