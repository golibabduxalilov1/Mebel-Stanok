import type { AttachmentType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { storage } from '../../lib/storage';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { writeActivity } from '../../utils/activityLog';

interface Actor {
  userId: string;
  userEmail?: string;
}

type Tx = Prisma.TransactionClient;

/** Unsets isMainImage on every other attachment of the machine, inside the caller's transaction. */
async function unsetOtherMainImages(tx: Tx, machineId: string, exceptId?: string) {
  await tx.machineAttachment.updateMany({
    where: { machineId, isMainImage: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { isMainImage: false },
  });
}

export const attachmentsService = {
  async listByMachine(machineId: string) {
    return prisma.machineAttachment.findMany({ where: { machineId }, orderBy: { uploadedAt: 'desc' } });
  },

  async upload(
    machineId: string,
    file: { originalname: string; buffer: Buffer; size: number },
    meta: { name?: string; type: AttachmentType; description?: string; isMainImage?: boolean },
    actor: Actor,
    thumbnail?: { buffer: Buffer; originalname: string }
  ) {
    const machine = await prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw Errors.notFound('Machine');

    const key = storage.buildKey(file.originalname);
    await storage.save(key, file.buffer);

    let thumbnailKey: string | undefined;
    if (thumbnail) {
      thumbnailKey = storage.buildKey(thumbnail.originalname || 'thumbnail.jpg');
      await storage.save(thumbnailKey, thumbnail.buffer);
    }

    const attachment = await prisma.$transaction(async (tx) => {
      if (meta.isMainImage) {
        await unsetOtherMainImages(tx, machineId);
      }
      const created = await tx.machineAttachment.create({
        data: {
          machineId,
          name: meta.name || file.originalname,
          type: meta.type,
          storageKey: key,
          thumbnailKey,
          size: file.size,
          uploadedBy: actor.userId,
          description: meta.description,
          isMainImage: Boolean(meta.isMainImage),
        },
      });
      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'machine',
        entityId: machineId,
        entityName: machine.name,
        details: `Добавлен файл "${created.name}" к станку "${machine.name}"`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return created;
    });

    emitEntity('attachment', 'created', attachment);
    return attachment;
  },

  async updateMeta(
    id: string,
    updates: { isMainImage?: boolean; description?: string; name?: string },
    actor: Actor
  ) {
    const original = await prisma.machineAttachment.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Attachment');

    const attachment = await prisma.$transaction(async (tx) => {
      if (updates.isMainImage) {
        await unsetOtherMainImages(tx, original.machineId, id);
      }
      const updated = await tx.machineAttachment.update({ where: { id }, data: updates });
      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'machine',
        entityId: original.machineId,
        entityName: updated.name,
        details: updates.isMainImage
          ? `Файл "${updated.name}" установлен главным изображением станка`
          : `Обновлены данные файла "${updated.name}"`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return updated;
    });

    emitEntity('attachment', 'updated', attachment);
    return attachment;
  },

  async addLink(
    machineId: string,
    input: { name?: string; type: AttachmentType; url: string; description?: string },
    actor: Actor
  ) {
    const machine = await prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw Errors.notFound('Machine');

    const attachment = await prisma.$transaction(async (tx) => {
      const created = await tx.machineAttachment.create({
        data: {
          machineId,
          name: input.name || input.url,
          type: input.type,
          storageKey: input.url,
          uploadedBy: actor.userId,
          description: input.description,
        },
      });
      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'machine',
        entityId: machineId,
        entityName: machine.name,
        details: `Добавлена ссылка "${created.name}" к станку "${machine.name}"`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return created;
    });

    emitEntity('attachment', 'created', attachment);
    return attachment;
  },

  async getForDownload(id: string) {
    const attachment = await prisma.machineAttachment.findUnique({ where: { id } });
    if (!attachment) throw Errors.notFound('Attachment');
    // link-type attachments store the external URL in storageKey instead of a local file.
    if (attachment.type === 'link') return attachment;
    if (!(await storage.exists(attachment.storageKey))) throw Errors.notFound('Attachment file');
    return attachment;
  },

  async getForThumbnail(id: string) {
    const attachment = await prisma.machineAttachment.findUnique({ where: { id } });
    if (!attachment) throw Errors.notFound('Attachment');
    if (!attachment.thumbnailKey || !(await storage.exists(attachment.thumbnailKey))) {
      throw Errors.notFound('Attachment thumbnail');
    }
    return attachment;
  },

  async remove(id: string, actor: Actor) {
    const attachment = await prisma.machineAttachment.findUnique({ where: { id }, include: { machine: true } });
    if (!attachment) throw Errors.notFound('Attachment');

    await prisma.$transaction(async (tx) => {
      await tx.machineAttachment.delete({ where: { id } });
      await writeActivity(tx, {
        actionType: 'delete',
        entityType: 'machine',
        entityId: attachment.machineId,
        entityName: attachment.machine.name,
        details: `Удален файл "${attachment.name}" со станка "${attachment.machine.name}"`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
    });

    if (attachment.type !== 'link') {
      await storage.remove(attachment.storageKey);
      if (attachment.thumbnailKey) await storage.remove(attachment.thumbnailKey);
    }
    emitEntity('attachment', 'deleted', { id, machineId: attachment.machineId });
  },
};
