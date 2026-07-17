import { redirect } from 'next/navigation';

/** theme.md §23 `/scanner` — maps to market scanner workspace */
export default function ScannerAliasPage() {
  redirect('/terminal');
}
