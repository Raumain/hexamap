import { createFileRoute } from '@tanstack/react-router';
import { LegalDocumentPage } from '../components/legal/legal-document';
import { CONFIDENTIALITE } from '../content/legal';

export const Route = createFileRoute('/confidentialite')({
  component: ConfidentialitePage,
});

function ConfidentialitePage() {
  return <LegalDocumentPage document={CONFIDENTIALITE} />;
}
