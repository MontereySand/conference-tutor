import type { Metadata } from "next";
import { connection } from "next/server";
import { parseLang } from "@/lib/i18n";
import { LoginForm } from "@/components/login/login-form";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const query = await searchParams;
  return <LoginForm initialLang={parseLang(query.lang)} />;
}
