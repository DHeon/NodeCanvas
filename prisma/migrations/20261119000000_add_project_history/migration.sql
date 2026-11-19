CREATE TABLE "project_history" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "projectId" UUID NOT NULL,
    "baseline" BOOLEAN NOT NULL DEFAULT false,
    "patch" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_history_projectId_seq_idx" ON "project_history"("projectId", "seq");
ALTER TABLE "project_history" ADD CONSTRAINT "project_history_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
