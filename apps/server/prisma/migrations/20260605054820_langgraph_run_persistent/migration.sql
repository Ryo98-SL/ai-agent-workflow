-- DropForeignKey
ALTER TABLE "run" DROP CONSTRAINT "run_workflowId_fkey";

-- AlterTable
ALTER TABLE "run" ALTER COLUMN "workflowId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "run" ADD CONSTRAINT "run_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
