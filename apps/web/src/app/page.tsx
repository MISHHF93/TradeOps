import { redirect } from 'next/navigation';

/** Local product: skip marketing/auth and open the terminal immediately. */
export default function HomePage() {
  redirect('/terminal');
}
