import { createFileRoute, notFound } from '@tanstack/react-router';
import { LegalDocumentPage } from '../components/legal/legal-document';
import { CONFIDENTIALITE, LEGAL_PAGES_ENABLED } from '../content/legal';

export const Route = createFileRoute('/confidentialite')({
  component: ConfidentialitePage,
});

function ConfidentialitePage() {
  if (!LEGAL_PAGES_ENABLED) throw notFound();

  return <LegalDocumentPage document={CONFIDENTIALITE} />;
}
