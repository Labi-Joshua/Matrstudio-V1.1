// Landing page for confirmation-email links: keep it out of search results.
export const metadata = {
  title: "You’re on the list | Matr Studio",
  robots: { index: false, follow: false },
};

export default function VerifiedPage() {
  return (
    <main>
      <h1>You're on the list</h1>
      <p>Your email is confirmed. We'll be in touch when Matr Studio opens.</p>
    </main>
  );
}
