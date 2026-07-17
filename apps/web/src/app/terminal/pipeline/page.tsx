import { redirect } from 'next/navigation';

/** Legacy pipeline route — merged into Commerce Process. */
export default function LegacyPipelineRedirect() {
  redirect('/terminal/process');
}
