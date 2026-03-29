"use client";

import { useRouter } from "next/navigation";
import { IntroFilmExperience } from "@/components/intro/IntroFilmExperience";

export function IntroClient() {
  const router = useRouter();
  return (
    <IntroFilmExperience
      onFilmEnd={() => {
        router.replace("/main");
      }}
    />
  );
}
