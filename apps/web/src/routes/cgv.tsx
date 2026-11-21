import { createFileRoute, notFound } from '@tanstack/react-router';
import { LegalDocumentPage } from '../components/legal/legal-document';
import { CGV_LEGAL, LEGAL_PAGES_ENABLED } from '../content/legal';

export const Route = createFileRoute('/cgv')({
  component: CgvPage,
});

function CgvPage() {
  if (!LEGAL_PAGES_ENABLED) throw notFound();

  return <LegalDocumentPage document={CGV_LEGAL} />;
}
