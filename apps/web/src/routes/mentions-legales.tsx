import { createFileRoute, notFound } from '@tanstack/react-router';
import { LegalDocumentPage } from '../components/legal/legal-document';
import { LEGAL_PAGES_ENABLED, MENTIONS_LEGALES } from '../content/legal';

export const Route = createFileRoute('/mentions-legales')({
  component: MentionsLegalesPage,
});

function MentionsLegalesPage() {
  if (!LEGAL_PAGES_ENABLED) throw notFound();

  return <LegalDocumentPage document={MENTIONS_LEGALES} />;
}
