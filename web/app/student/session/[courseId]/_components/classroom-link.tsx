"use client";

import { Button } from "@/components/ui/button";

type Props = {
  url: string;
};

export function ClassroomLink({ url }: Props) {
  const handleClick = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Button variant="outline" onClick={handleClick}>
      Google Classroomを開く
    </Button>
  );
}
