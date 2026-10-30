interface StoredImage {
  buffer: Buffer;
  mimeType: string;
  createdAt: number;
}

class EphemeralImageStore {
  private garments = new Map<string, StoredImage>();
  private sources = new Map<string, StoredImage>();
  private readonly ttlMs = 4 * 60 * 60 * 1000; // 4 hours

  saveGarment(proposalId: string, buffer: Buffer, mimeType = "image/png") {
    this.cleanup();
    this.garments.set(proposalId, {
      buffer,
      mimeType,
      createdAt: Date.now()
    });
  }

  getGarment(proposalId: string): StoredImage | null {
    const item = this.garments.get(proposalId);
    if (!item) return null;
    if (Date.now() - item.createdAt > this.ttlMs) {
      this.garments.delete(proposalId);
      return null;
    }
    return item;
  }

  deleteGarment(proposalId: string) {
    this.garments.delete(proposalId);
  }

  saveSource(sessionId: string, buffer: Buffer, mimeType = "image/png") {
    this.cleanup();
    this.sources.set(sessionId, {
      buffer,
      mimeType,
      createdAt: Date.now()
    });
  }

  getSource(sessionId: string): StoredImage | null {
    const item = this.sources.get(sessionId);
    if (!item) return null;
    if (Date.now() - item.createdAt > this.ttlMs) {
      this.sources.delete(sessionId);
      return null;
    }
    return item;
  }

  deleteSource(sessionId: string) {
    this.sources.delete(sessionId);
  }

  purgeSession(sessionId: string, proposalIds: string[] = []) {
    this.deleteSource(sessionId);
    for (const pid of proposalIds) {
      this.deleteGarment(pid);
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [k, v] of this.garments.entries()) {
      if (now - v.createdAt > this.ttlMs) {
        this.garments.delete(k);
      }
    }
    for (const [k, v] of this.sources.entries()) {
      if (now - v.createdAt > this.ttlMs) {
        this.sources.delete(k);
      }
    }
  }
}

export const ephemeralImageStore = new EphemeralImageStore();
