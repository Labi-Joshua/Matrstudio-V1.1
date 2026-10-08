// Landing page for confirmation-email links: keep it out of search results.
export const metadata = {
  title: "Link expired | Matr Studio",
  robots: { index: false, follow: false },
};

export default function VerifyFailedPage() {
  return (
    <main>
      <h1>That link didn't work</h1>
      <p>
        The confirmation link is invalid or has expired. Join the waitlist again to get a new one.
      </p>
    </main>
  );
}
