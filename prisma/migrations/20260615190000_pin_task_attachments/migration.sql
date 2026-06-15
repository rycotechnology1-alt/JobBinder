-- Link uploaded files to markup pins and link one task back to its source pin.
ALTER TABLE "File" ADD COLUMN "markupMarkId" TEXT;
ALTER TABLE "Task" ADD COLUMN "sourceMarkupMarkId" TEXT;

CREATE UNIQUE INDEX "Task_sourceMarkupMarkId_key" ON "Task"("sourceMarkupMarkId");
CREATE INDEX "File_markupMarkId_idx" ON "File"("markupMarkId");

ALTER TABLE "File"
  ADD CONSTRAINT "File_markupMarkId_fkey"
  FOREIGN KEY ("markupMarkId") REFERENCES "FileMarkupMark"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_sourceMarkupMarkId_fkey"
  FOREIGN KEY ("sourceMarkupMarkId") REFERENCES "FileMarkupMark"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
