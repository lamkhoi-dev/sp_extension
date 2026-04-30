const logger = require('../logger');

// Concurrent message handler — parallel across threads, sequential within same thread
// This ensures:
// - 5 different users → 5 replies processed simultaneously
// - 1 user sends 3 messages → processed in order (no reply jumbling)
class ConcurrentHandler {
  constructor() {
    this.threadQueues = new Map(); // threadId → Promise chain
  }

  // Process a message, respecting per-thread sequential order
  async process(threadId, handler) {
    // Get current chain for this thread (or resolved promise if none)
    const currentChain = this.threadQueues.get(threadId) || Promise.resolve();

    // Chain the new handler onto the existing one
    const newChain = currentChain
      .then(() => handler())
      .catch((err) => {
        logger.error('ConcurrentHandler', `Thread ${threadId}: ${err.message}`);
      })
      .finally(() => {
        // Clean up if this is the last handler in the chain
        if (this.threadQueues.get(threadId) === newChain) {
          this.threadQueues.delete(threadId);
        }
      });

    this.threadQueues.set(threadId, newChain);
    return newChain;
  }

  get activeThreads() {
    return this.threadQueues.size;
  }
}

module.exports = ConcurrentHandler;
