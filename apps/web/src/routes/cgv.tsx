import { createFileRoute } from '@tanstack/react-router';
import { LegalDocumentPage } from '../components/legal/legal-document';
import { CGV_LEGAL } from '../content/legal';

export const Route = createFileRoute('/cgv')({
  component: CgvPage,
});

function CgvPage() {
  return <LegalDocumentPage document={CGV_LEGAL} />;
}
