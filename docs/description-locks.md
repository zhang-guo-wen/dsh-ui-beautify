# Description translation process locks

[中文](<description-locks.zh.md>)

## Safety contract

Locks coordinate hosts on the **same local filesystem and PID namespace**. All concurrently running writers must use this protocol; stop old hosts before upgrading. PID reuse and permission-denied process probes are treated as live/unknown, never as proof of death. This is not a distributed lock or a defense against a malicious process rewriting the data directory.

The record key is a SHA-256 filename under `description-translations/v1`. A lock is a real, non-symlink directory containing exactly one zero-byte regular `PID.UUID.owner` file. Unknown files, empty legacy locks, malformed markers, and symlink locks are preserved; waiting remains bounded by request cancellation/timeout.

## Publication and single-winner retirement

1. Prepare a uniquely named `.lock.candidate-PID.UUID.owner` directory and owner marker off-path. Publish it with one directory rename to `.lock`. Participating writers only publish **nonempty** directories, so a competing publication cannot replace an existing lock. Crashing before publication leaves inert candidate metadata, not a blocking empty canonical lock.
2. Release or recover by renaming the whole canonical directory to `.lock.retired-PID.UUID.owner`. Recovery requires `kill(pid, 0)` to report `ESRCH`, and revalidates the exact owner before the rename and on each retry. Normal release uses the **same** destination.
3. The retired directory stays nonempty permanently. Rename cannot overwrite this fence, even if a second observer pauses after validation until a newer owner has acquired the canonical path. Only one observer can retire that generation. A crash immediately after retirement already leaves the canonical path available; there is no recovery-claim lease to expire.
4. Never unlink the canonical owner or remove the canonical directory. Windows can report two concurrent unlinks of the same marker as successful; that is not a single-winner election.
5. Windows `EPERM`/`EACCES`/`EBUSY` rename failures have at most four 25 ms retries after the initial attempt. Persistent failures fail closed, never bypass permissions. Acquisition/write failures can surface as storage errors; a cleanup failure after a committed batch result or abandoned request may leave a live-PID lock until the owner exits, without changing the already returned result. Waiting for a known live lock remains governed by the request deadline.

## Metadata retention and maintenance

Each acquired generation retains one tiny directory and empty owner marker. Initial lookup cache hits do not acquire a lock; a waiting contender that finds a cache record only after acquiring its lock still adds a fence; failed/aborted generation attempts can add markers. A pre-publication crash can also leave a candidate directory. These are intentional safety metadata, not cached translation text.

**Do not delete retired fences while any host or paused lock observer is running.** Deleting a fence reopens the ABA race. If metadata needs cleanup, stop every host sharing this data directory first, verify no observers remain, back up the directory, and inspect the exact generated paths manually. The plugin does not recursively delete or scan unrelated directories. Unknown legacy locks require manual investigation rather than automatic age-based cleanup.

## Regression evidence

`tests/description-process-lock.test.mjs` includes real child-process gates at the filesystem rename boundary: a stale reclaimer resumes only after a winner retires the old lock and a successor acquires it. Other cases cover crashes before/after publication and immediately after retirement/release, token replacement, unknown and malformed markers, live-owner cancellation, ignored-abort inference, and bounded injected Windows sharing violations. Repeated two-host orphan races supplement these deterministic tests; they do not replace them.
