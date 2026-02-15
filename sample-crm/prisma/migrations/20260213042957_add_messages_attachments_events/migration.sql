-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'CHAT', 'PHONE', 'WEB');

-- CreateEnum
CREATE TYPE "AuthorType" AS ENUM ('CUSTOMER', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TicketEventType" AS ENUM ('TICKET_CREATED', 'TICKET_UPDATED', 'MESSAGE_ADDED', 'STATUS_CHANGED', 'TAG_CHANGED', 'ATTACHMENT_ADDED');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "channel" "Channel",
ADD COLUMN     "customerName" TEXT NOT NULL DEFAULT 'Unknown',
ADD COLUMN     "customerOrg" TEXT,
ADD COLUMN     "productArea" TEXT NOT NULL DEFAULT 'General';

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" "AuthorType" NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messageId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "type" "TicketEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TicketMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
