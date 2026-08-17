"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/register");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen text-gray-500 text-sm">
      Redirection vers la page d'inscription...
    </div>
  );
}
