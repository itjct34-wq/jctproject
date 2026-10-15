import { redirect } from 'next/navigation';

/** Soft redirect: reservations live on vehicle stock Actions / Reserve. */
export default function SalesPageRedirect() {
  redirect('/vehicles');
}
