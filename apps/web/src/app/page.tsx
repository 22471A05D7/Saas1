import { redirect } from 'next/navigation';

/**
 * The root path has no content of its own. Middleware has already decided
 * whether a visitor has a session, so this just forwards to the dashboard and
 * lets that redirect bounce signed-out visitors to the login page.
 */
export default function HomePage() {
  redirect('/dashboard');
}
