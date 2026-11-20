import { createFileRoute } from '@tanstack/react-router';
import { LegalDocumentPage } from '../components/legal/legal-document';
import { MENTIONS_LEGALES } from '../content/legal';

export const Route = createFileRoute('/mentions-legales')({
  component: MentionsLegalesPage,
});

function MentionsLegalesPage() {
  return <LegalDocumentPage document={MENTIONS_LEGALES} />;
}
