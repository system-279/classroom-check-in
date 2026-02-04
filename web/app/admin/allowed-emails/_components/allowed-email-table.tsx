"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { AllowedEmail } from "@/types/allowed-email";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

type Props = {
  allowedEmails: AllowedEmail[];
  onDelete: () => void;
};

export function AllowedEmailTable({ allowedEmails, onDelete }: Props) {
  if (allowedEmails.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        許可されたメールアドレスがありません
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>メールアドレス</TableHead>
            <TableHead>メモ</TableHead>
            <TableHead>追加日時</TableHead>
            <TableHead className="w-[100px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allowedEmails.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.email}</TableCell>
              <TableCell className="text-muted-foreground">
                {item.note ?? "-"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(item.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </TableCell>
              <TableCell>
                <DeleteConfirmDialog
                  allowedEmail={item}
                  onSuccess={onDelete}
                  trigger={
                    <Button variant="destructive" size="sm">
                      削除
                    </Button>
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
