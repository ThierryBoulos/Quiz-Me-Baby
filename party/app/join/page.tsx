import { JoinForm } from "@/components/JoinForm";

/* The join screen comes from the server with the code already in it, so it's
   on the phone the moment the QR opens it, not after the app has loaded. */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <JoinForm initial={code ?? ""} />;
}
